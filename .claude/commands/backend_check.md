# Backend check

请帮我在「/Users/wanghejie/workspace/new-api」路径下执行后端本地 CI 检查，并修复流程本身的错误，确保后端检查链路可以明确给出通过或失败结果。

## 执行步骤
1. 跳转至「/Users/wanghejie/workspace/new-api」
2. 执行「make check-backend」
3. 如果 gofmt 检查失败，按输出文件执行格式化后重新运行
4. 如果 go vet、golangci-lint、go test 或 go build 失败，先判断是业务代码问题还是流程配置问题
5. 仅在确认为业务代码本身存在实际问题时修复业务代码，然后重新运行「make check-backend」直到通过

## 注意事项
- 按照步骤顺序执行，确保每一步都通过后再进行下一步
- `golangci-lint` 是阻塞检查，本机必须安装且版本应兼容仓库根目录 `.golangci.yml`
- 不要跳过 gofmt、go vet、golangci-lint、go test 或 go build 中的任何失败
- 如果失败来自既有环境缺口，需要明确说明缺失工具或依赖，而不是静默跳过
