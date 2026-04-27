# Frontend check

请帮我在「/Users/wanghejie/workspace/new-api」路径下执行前端本地 CI 检查和生产构建，并修复流程本身的错误，确保前端检查链路可以明确给出通过或失败结果。

## 执行步骤
1. 跳转至「/Users/wanghejie/workspace/new-api」
2. 执行「make check-frontend」
3. 如果依赖安装、prettier、eslint、i18n lint、Bun 单测或 Vite 构建失败，先判断是业务代码问题还是流程配置问题
4. 仅在确认为业务代码本身存在实际问题时修复业务代码
5. 重新运行「make check-frontend」直到通过

## 注意事项
- 按照步骤顺序执行，确保每一步都通过后再进行下一步
- 前端测试使用 Bun 原生 runner，不引入 Vitest、jsdom 或 testing-library 依赖
- `make check-frontend` 会先执行 `make check-frontend-fast`，再执行 `bun run build`
- 构建成功后应生成 `web/dist/index.html`，供 Go embed 编译链路使用
