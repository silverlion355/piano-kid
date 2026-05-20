package com.pianokid.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import java.io.File;
import java.io.FileWriter;
import java.io.PrintWriter;

public class MainActivity extends AppCompatActivity {

    private static final String TAG = "PianoKid";
    private static final int REQ_AUDIO = 1001;

    private WebView webView;
    private Handler handler = new Handler(Looper.getMainLooper());
    private MicController micController;
    private StorageController storageController;

    // ---- JS Interface: MicController ----
    public class MicController {
        private AudioRecord audioRecord;
        private boolean isRecording = false;
        private Thread recordThread;
        private int sampleRate = 44100;
        private int bufferSize = 2048;
        private volatile float currentPitch = -1;

        public String isAvailable() {
            boolean has = ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.RECORD_AUDIO)
                    == PackageManager.PERMISSION_GRANTED;
            return has ? "true" : "false";
        }

        public String start() {
            if (isRecording) return "already_started";
            if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.RECORD_AUDIO)
                    != PackageManager.PERMISSION_GRANTED) {
                requestAudioPerm();
                return "no_permission";
            }
            try {
                int minBuf = AudioRecord.getMinBufferSize(sampleRate,
                        AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
                bufferSize = Math.max(bufferSize, minBuf);
                audioRecord = new AudioRecord(
                        MediaRecorder.AudioSource.MIC,
                        sampleRate,
                        AudioFormat.CHANNEL_IN_MONO,
                        AudioFormat.ENCODING_PCM_16BIT,
                        bufferSize * 2);
                if (audioRecord.getState() != AudioRecord.STATE_INITIALIZED) {
                    return "init_failed";
                }
                audioRecord.startRecording();
                isRecording = true;
                recordThread = new Thread(() -> {
                    short[] buffer = new short[bufferSize];
                    PitchDetector pd = new PitchDetector(sampleRate);
                    while (isRecording) {
                        int read = audioRecord.read(buffer, 0, bufferSize);
                        if (read > 0) {
                            float[] floatBuf = new float[read];
                            for (int i = 0; i < read; i++) floatBuf[i] = buffer[i] / 32768f;
                            float pitch = pd.detectPitch(floatBuf);
                            currentPitch = pitch;
                            // Send pitch to JS via evaluateJavascript
                            final float p = pitch;
                            handler.post(() -> {
                                if (webView != null) {
                                    webView.evaluateJavascript(
                                            "if(window._onPitch)window._onPitch(" + p + ")",
                                            null);
                                }
                            });
                        }
                        try { Thread.sleep(20); } catch (InterruptedException e) {}
                    }
                });
                recordThread.start();
                jsLog("info", "Mic", "Microphone started");
                return "ok";
            } catch (Exception e) {
                jsLog("error", "Mic", "start error: " + e.getMessage());
                return "error:" + e.getMessage();
            }
        }

        public String stop() {
            isRecording = false;
            if (recordThread != null) { recordThread.interrupt(); recordThread = null; }
            if (audioRecord != null) {
                try { audioRecord.stop(); audioRecord.release(); } catch (Exception e) {}
                audioRecord = null;
            }
            currentPitch = -1;
            jsLog("info", "Mic", "Microphone stopped");
            return "ok";
        }

        public String getPitch() {
            return String.valueOf(currentPitch);
        }
    }

    // ---- JS Interface: StorageController ----
    public class StorageController {
        public void set(String key, String value) {
            runOnUiThread(() -> {
                webView.evaluateJavascript(
                        "javascript:localStorage.setItem('pianokid_" + key + "','"
                                + value.replace("'", "\\'") + "')", null);
            });
        }
        public String get(String key) {
            final String[] result = {""};
            runOnUiThread(() -> {
                webView.evaluateJavascript(
                        "javascript:(localStorage.getItem('pianokid_" + key + "')||'')",
                        v -> result[0] = v
                );
            });
            return result[0];
        }
    }

    // ---- Simple Pitch Detector (YIN-ish) ----
    public static class PitchDetector {
        private final int sampleRate;
        private final int bufferSize;
        private final float[] yinBuffer;

        public PitchDetector(int sampleRate) {
            this.sampleRate = sampleRate;
            this.bufferSize = 2048;
            this.yinBuffer = new float[bufferSize / 2];
        }

        public float detectPitch(float[] buffer) {
            int half = bufferSize / 2;
            // Step 1: Difference function
            for (int tau = 0; tau < half; tau++) {
                yinBuffer[tau] = 0;
                for (int i = 0; i < half; i++) {
                    float delta = buffer[i] - buffer[i + tau];
                    yinBuffer[tau] += delta * delta;
                }
            }
            // Step 2: Cumulative mean normalized difference
            yinBuffer[0] = 1;
            float runningSum = 0;
            for (int tau = 1; tau < half; tau++) {
                runningSum += yinBuffer[tau];
                yinBuffer[tau] = yinBuffer[tau] * tau / runningSum;
            }
            // Step 3: Absolute threshold
            float threshold = 0.1f;
            int tauBest = -1;
            for (int tau = 2; tau < half; tau++) {
                if (yinBuffer[tau] < threshold) {
                    while (tau + 1 < half && yinBuffer[tau + 1] < yinBuffer[tau]) tau++;
                    tauBest = tau;
                    break;
                }
            }
            if (tauBest == -1) {
                // Find min
                float minVal = Float.MAX_VALUE;
                for (int tau = 2; tau < half; tau++) {
                    if (yinBuffer[tau] < minVal) { minVal = yinBuffer[tau]; tauBest = tau; }
                }
            }
            if (tauBest < 2) return -1;
            // Step 4: Parabolic interpolation
            float betterTau = tauBest;
            if (tauBest > 0 && tauBest < half - 1) {
                float s0 = yinBuffer[tauBest - 1];
                float s1 = yinBuffer[tauBest];
                float s2 = yinBuffer[tauBest + 1];
                betterTau = tauBest + (s2 - s0) / (2 * (2 * s1 - s2 - s0));
            }
            return sampleRate / betterTau;
        }
    }

    // ---- Helpers ----
    private void jsLog(String level, String tag, String msg) {
        Log.d(TAG, "[" + tag + "] " + msg);
        if (webView != null) {
            String encoded = msg.replace("\\", "\\\\").replace("'", "\\'").replace("\"", "\\\"");
            webView.evaluateJavascript(
                    "if(window._log)window._log('" + level + "','" + tag + "','" + encoded + "')",
                    null);
        }
    }

    private void requestAudioPerm() {
        ActivityCompat.requestPermissions(MainActivity.this,
                new String[]{Manifest.permission.RECORD_AUDIO}, REQ_AUDIO);
    }

    @Override
    public void onRequestPermissionsResult(int req, @NonNull String[] perms, @NonNull int[] results) {
        if (req == REQ_AUDIO) {
            boolean granted = results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED;
            jsLog("info", "Perm", "Audio permission " + (granted ? "granted" : "denied"));
            if (granted && webView != null) {
                webView.evaluateJavascript("if(window._onPermResult)window._onPermResult(true)", null);
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null) {
            webView.evaluateJavascript("if(window._onBackPressed)window._onBackPressed()", null);
        }
        // Don't super.onBackPressed() — let JS handle it first
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings ws = webView.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setMediaPlaybackRequiresUserGesture(true);
        ws.setAllowFileAccess(true);
        ws.setUseWideViewPort(true);
        ws.setLoadWithOverviewMode(true);

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    request.grant(request.getResources());
                }
            }
        });

        webView.setWebViewClient(new WebViewClient());

        micController = new MicController();
        storageController = new StorageController();
        webView.addJavascriptInterface(micController, "AndroidMic");
        webView.addJavascriptInterface(storageController, "AndroidStorage");

        webView.loadUrl("file:///android_asset/pianokid/index.html");
        jsLog("info", "App", "PianoKid v1.0.0 started");
    }

    @Override
    protected void onDestroy() {
        if (micController != null) micController.stop();
        if (webView != null) { webView.destroy(); }
        super.onDestroy();
    }
}