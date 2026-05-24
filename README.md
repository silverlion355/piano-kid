# 钢琴小达人

儿童钢琴跟弹游戏 - Piano Learning Game

## 功能特点

- 🎹 双八度钢琴键盘 (C3-C5)
- 🎼 五线谱显示，跟弹练习
- 🎮 6首内置儿歌，闯关模式
- 🏆 星星评分系统 & 金币奖励
- 🛒 商店系统：免费时间、礼物、解锁关卡
- 📊 调试日志，方便排查问题

## 歌曲列表

1. 小星星 ⭐
2. 两只老虎 ⭐⭐
3. 欢乐颂 ⭐⭐
4. 粉刷匠 ⭐⭐⭐
5. 洋娃娃和小熊跳舞 ⭐⭐⭐
6. 天空之城 ⭐⭐⭐⭐

## 技术架构

- Android WebView + JavaScript 混合开发
- YIN 音高检测算法
- Canvas 2D 五线谱绘制
- GitHub Actions CI/CD 自动构建

## 构建

```bash
./gradlew assembleDebug
```

## APK 下载

CI 构建完成后可在 Actions 日志中下载