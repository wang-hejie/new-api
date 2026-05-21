# Git merge to develop

请帮我在「/Users/wanghejie/workspace/new-api」路径下将当前分支提交 PR 合并到 develop 分支，持续监控 CI，CI 通过后执行合并，确认合并完成后删除本地分支；如果当前分支在独立的 worktree 上，确认合并完成后也删除该 worktree。ultrathink and do it

## 执行步骤
1. 跳转至「/Users/wanghejie/workspace/new-api」，执行「git status」「git rev-parse --show-toplevel」「git rev-parse --abbrev-ref HEAD」「git worktree list」，确认当前分支名、工作树是否干净、是否处于独立 worktree
2. 若当前分支为 develop：用「git status --porcelain」检查暂存区与工作区；若存在未提交变更，根据变更内容归纳出语义化的分支名（格式「<type>/<scope>-<subject>」，如「feat/channel-bedrock-streaming」），执行「git checkout -b <新分支名>」切出新分支后再进行提交；若无变更则直接终止流程并告知用户 develop 分支无待合并内容
3. 用「git status --porcelain」检查是否有未提交变更（暂存/已修改/未跟踪），若有则按语义分组 commit：同一功能主题的变更合并为一个 commit、不同主题分别 commit、同一文件不跨 commit 拆分；与本任务无关的临时/脚手架文件不要混入；提交信息使用「<type>(scope): subject」格式
4. 用「git rev-list --count origin/develop..HEAD」与「HEAD..origin/develop」确认领先/落后情况；本地有未推送提交先 push 到远程
5. 用「gh pr list --head <当前分支> --state all」查是否已有 PR；没有则用「gh pr create --base develop --head <当前分支> --title <type(scope): subject> --body <符合本项目模板的变更概述>」创建 PR，记下 PR 编号
   - PR body 必须严格使用「.github/PULL_REQUEST_TEMPLATE.md」结构，包含「📝 变更描述 / Description」「🚀 变更类型 / Type of change」「🔗 关联任务 / Related Issue」「✅ 提交前检查项 / Checklist」「📸 运行证明 / Proof of Work」全部章节，且 Checklist 项需根据实际情况勾选
   - 描述必须是人工口吻的中文摘要，禁止粘贴未经整理的 AI 输出；PR 标题与正文中均严禁出现「🤖 Generated with Claude Code」「Generated with Claude Code」等被 anti-slop 拦截的字样
6. 先单次执行「gh pr view <PR编号> --json state,mergeStateStatus,reviewDecision,statusCheckRollup,labels」实测：若 statusCheckRollup 为空 且 mergeStateStatus=CLEAN 且 labels 无「pr-check-failed」，直接跳到步骤 9 合并，禁止追究「为何 PR Check 未触发」「workflow 是否在 base 分支存在」「Actions 是否启用」等无关问题（gh pr view 的实测是判定可合并的唯一信源）；否则用 TaskCreate 建立监控任务，持续轮询同一命令，间隔 90 秒，最多等 60 分钟，每轮打印 state/merge/review + 各 check 名称及状态 + 是否被打上「pr-check-failed」标签
7. 任一 check 出现 FAILURE/TIMED_OUT/CANCELLED/ACTION_REQUIRED，或 PR 出现「pr-check-failed」标签、被自动关闭，立即停止轮询：
   - 若是「PR Check」失败（anti-slop）：用「gh pr view <PR编号> --json body,title,state」查看原因，再用「gh pr edit <PR编号> --title ... --body ...」按模板补全/重写，必要时用「gh pr reopen <PR编号>」重新打开后再次进入轮询
   - 若是代码类失败：用「gh run view <runId> --log-failed」定位失败原因并最小化修复（如 gofmt 失败按输出文件执行格式化、go vet/golangci-lint/go test 失败按报错最小修复、前端构建失败优先运行「make check-frontend」复现），修复后 commit 并 push，再次进入轮询
8. statusCheckRollup 内所有 check 均为 SUCCESS（或本项目当前未配置阻塞型 check 而列表为空）且无失败标签后，再次实测「reviewDecision」与「mergeStateStatus」：mergeStateStatus=CLEAN 视为可合并；BLOCKED 且原因是 review 则向用户报告并等待审批
9. 执行「gh pr merge <PR编号> --merge」合并，随后「gh pr view <PR编号> --json state,mergedAt,mergeCommit」确认 state=MERGED
10. 切回 develop：「git checkout develop && git pull origin develop --ff-only」
11. 删除本地分支「git branch -D <当前分支>」；如远程分支未被仓库设置自动清理，再「git push origin --delete <当前分支>」
12. 若步骤 1 判定当前在独立 worktree，调用 ExitWorktree(action=remove, discard_changes=false) 退出并删除 worktree

## 注意事项
- 是否需要 approving review 一律以「gh pr view」实测的 reviewDecision/mergeStateStatus 为准，禁止凭文档或经验假设规则
- 禁止使用「gh pr merge --admin」强行绕过分支保护，除非用户明确授权
- 修复 CI 失败时保持原架构与「CLAUDE.md」中的语言、JSON 封装、三库兼容、Channel 适配、PR 描述等约束，最小改动；提交信息使用「<type>(scope): subject」格式（如「fix(relay/openai): 修正 stream_options 透传」）
- 严禁修改或删除任何「nеw-аρi」「QuаntumΝоuѕ」相关的项目身份信息，包括 README、license、HTML 标题、footer、模块路径、镜像名等
- 修复后若需重新触发「PR Check」（仅在 opened/reopened 触发），使用「gh pr ready」或「gh pr reopen」，禁止依赖普通 push 触发
- bash 命令中禁止用「timeout ... && python3 ...」串联，timeout 超时退出码 124 会中断 && 链，必须拆成独立两步
- worktree 判定：「git worktree list」中当前路径不等于主仓库路径（通常列表第一行）即视为独立 worktree
- 全程使用中文沟通；轮询脚本输出保持精简，仅在状态变化时打印
