# dsh-usage

[![npm](https://img.shields.io/npm/v/dsh-usage?color=CB3837)](https://www.npmjs.com/package/dsh-usage)
[![CI](https://github.com/kestiny18/dsh-plugins/actions/workflows/ci.yml/badge.svg)](https://github.com/kestiny18/dsh-plugins/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

[English](https://github.com/kestiny18/dsh-plugins/blob/main/dsh-usage/README.md) · **简体中文**

看清每一次 AI 调用消耗了多少 Token。`dsh-usage` 为 DeepSeek Harness Web 增加单轮用量摘要、模型费用估算和 52 周活动面板。

> 这是由社区独立维护的插件，并非 DeepSeek 官方插件。费用是估算值，不代表供应商最终账单。

![Settings → Usage 用量面板](https://github.com/user-attachments/assets/5f67e3d8-baab-4387-a778-01df8adb1dcd)

## 你会得到什么

- 每轮对话结束后显示简洁的 `Total · Input · Cache · Output · Cost` 摘要。
- 独立的 **设置 → Usage** 页面，可按模型、会话和单轮查看用量。
- 基于持久化会话历史生成的 GitHub 风格 52 周热力图。
- 与 Provider 无关的统计：只要模型返回标准 usage，就能记录 Token。
- 完全可选、默认关闭的 [DSH Community](https://dshcommunity.com) 聚合数据分享。

插件直接回放 Harness 已有的 Session 日志，不会再创建一套用量数据库。本地 Usage 始终独立于 Community 登录和网络状态。

## 30 秒安装

需要 Node.js 22.18 或更高版本，以及已有的 DeepSeek Harness Web Profile。

```powershell
npx --yes --package=@deepseek-ai/dsh --package=pnpm@11.9.0 -- dsh plugin --profile web add dsh-usage
npx --yes @deepseek-ai/dsh --profile web --dump-config
npx --yes @deepseek-ai/dsh --profile web
```

打开终端输出的 Web 地址，完成一次模型回复，然后查看对话下方的用量摘要和 **设置 → Usage**。首次安装后需要重启 Harness，让 Web 客户端发现新插件。

命令固定使用已经验证可用的 pnpm 11.9.0 安装基线。不要换成 pnpm 11.7.0，该版本可能在安装插件时失败。

[升级、全局 CLI、源码运行、代理和故障排查](https://github.com/kestiny18/dsh-plugins/blob/main/dsh-usage/docs/installation.md)

## 是否加入 Community，由你决定

连接 GitHub 和开启 Community Sync 是两个独立选择。GitHub 登录只用于确认公开身份，**不会**自动上传数据；只有你在 **设置 → Usage** 中主动打开同步开关后，插件才会发送聚合数据。

开启后只上传按天和按模型汇总的请求数及 Token 总量。提示词、回复、Session 内容、工具内容、路径、主机名、硬件标识和费用都不会上传。未知或私有模型路由会在本地合并为 `other`。即使同步失败，本地 Usage 也不会受到影响。

[查看排行榜和图文安装指南 →](https://dshcommunity.com)

![DSH Community 公开排行榜](https://raw.githubusercontent.com/kestiny18/dsh-plugins/main/dsh-usage/docs/images/community-leaderboard.png)

## 可信的统计口径

普通输入、缓存读取、缓存写入和输出分别统计。Provider 已经计入 Output 的推理 Token 不会重复计算。fork 和子 Agent 会扣除继承自父会话的 seed 事件，同时保留子 Agent 自己产生的新模型调用，包括缓存命中。

只有相关调用都提供 usage，并且都能匹配生效日期对应的价格时，才会显示费用。条件不完整时仍展示 Token，但省略 Cost，避免把部分费用误认为总费用。

- [统计模型、覆盖范围和限制](https://github.com/kestiny18/dsh-plugins/blob/main/dsh-usage/docs/accounting.md)
- [价格配置](https://github.com/kestiny18/dsh-plugins/blob/main/dsh-usage/docs/pricing.md)

## 相关链接

- [DSH Community](https://dshcommunity.com)
- [npm 包](https://www.npmjs.com/package/dsh-usage)
- [源码仓库](https://github.com/kestiny18/dsh-plugins/tree/main/dsh-usage)
- [最初的介绍帖](https://github.com/deepseek-ai/deepseek-harness/discussions/1169)
- [问题与反馈](https://github.com/kestiny18/dsh-plugins/issues)
- [参与贡献](https://github.com/kestiny18/dsh-plugins/blob/main/CONTRIBUTING.md)

采用 MIT License。
