---
slug: gpt-image-2-examples
title: 集成示例
order: 40
category: 模型指南
---

# 集成示例

- 本页集中展示 SDK 与 curl 用法
- 主接口参数与响应结构请优先查看对应 operation 页面
- 代码块仅作为集成样板，不作为右侧主请求/响应示例来源

## Python OpenAI SDK

### 基础生图

```python example title="Python 基础生图"
from openai import OpenAI
import base64

client = OpenAI(
    base_url="https://www.aiartmirror.com/v1",
    api_key="<YOUR_TOKEN>",
    timeout=120.0,
)

resp = client.images.generate(
    model="gpt-image-2",
    prompt="a cat sitting on a windowsill at golden hour",
    n=1,
    size="1024x1024",
    quality="low",
)

with open("out.png", "wb") as f:
    f.write(base64.b64decode(resp.data[0].b64_json))
```

### 显式返回 URL

```python example title="Python URL 响应"
resp = client.images.generate(
    model="gpt-image-2",
    prompt="a serene mountain lake at dawn",
    response_format="url",
)

url = resp.data[0].url
```

### 参考图编辑

```python example title="Python 参考图编辑"
with open("input.png", "rb") as img:
    resp = client.images.edit(
        model="gpt-image-2",
        image=img,
        prompt="change the apple color to bright green",
        n=1,
        size="1024x1024",
        quality="low",
        extra_body={"reference_usage": "subject"},
    )

with open("edited.png", "wb") as f:
    f.write(base64.b64decode(resp.data[0].b64_json))
```

## Node.js OpenAI SDK

```javascript example title="Node.js 基础生图"
import OpenAI from "openai";
import fs from "fs";

const client = new OpenAI({
  baseURL: "https://www.aiartmirror.com/v1",
  apiKey: "<YOUR_TOKEN>",
  timeout: 120000,
});

const resp = await client.images.generate({
  model: "gpt-image-2",
  prompt: "a serene mountain lake at dawn",
  n: 1,
  size: "1024x1024",
  quality: "low",
});

fs.writeFileSync("out.png", Buffer.from(resp.data[0].b64_json, "base64"));
```

## curl

### 文本生成图像

```bash example title="curl 文本生成图像"
curl https://www.aiartmirror.com/v1/images/generations \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-image-2",
    "prompt": "a red apple on a white background",
    "n": 1,
    "size": "1024x1024",
    "quality": "low"
  }' | jq -r '.data[0].b64_json' | base64 -d > apple.png
```

### 返回 URL

```bash example title="curl URL 响应"
curl https://www.aiartmirror.com/v1/images/generations \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-image-2",
    "prompt": "a red apple on a white background",
    "response_format": "url"
  }' | jq -r '.data[0].url'
```

### 参考图编辑

```bash example title="curl 参考图编辑"
curl https://www.aiartmirror.com/v1/images/edits \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -F "model=gpt-image-2" \
  -F "prompt=change the apple color to bright green" \
  -F "n=1" \
  -F "size=1024x1024" \
  -F "quality=low" \
  -F "reference_usage=subject" \
  -F "image=@input.png"
```
