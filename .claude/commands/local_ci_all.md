# Local CI all

请帮我在「/Users/wanghejie/workspace/new-api」路径下执行完整本地 CI 检查流程，并修复流程本身的错误，确保前后端检查链路可以明确给出通过或失败结果。

## 执行步骤
1. 跳转至「/Users/wanghejie/workspace/new-api」
2. 执行「make check-all」
3. 确认执行顺序为前端 full 检查先跑，后端检查后跑
4. 如果任一步失败，先判断是业务代码问题还是流程配置问题
5. 仅在确认为业务代码本身存在实际问题时修复业务代码，然后重新运行「make check-all」直到通过

## 注意事项
- `make check-all` 必须先执行 `make check-frontend`，再执行 `make check-backend`
- 前端构建必须先生成 `web/dist/index.html`，否则后端 Go embed 编译链路可能失败
- 任一步失败都应停止，不要跳过 prettier、eslint、i18n lint、Bun 单测、gofmt、go vet、golangci-lint、go test 或 go build
- `golangci-lint` 是阻塞检查，本机必须安装且版本应兼容仓库根目录 `.golangci.yml`
