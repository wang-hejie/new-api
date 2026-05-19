# Git merge develop to main

请帮我在「/Users/wanghejie/workspace/new-api」路径下将 develop 分支提交一个 PR 到 main，持续监控 CI，CI 通过后执行合并，确认合并完成后将远程最新 main 拉取到本地。ultrathink and do it

## 执行步骤
1. 跳转至「/Users/wanghejie/workspace/new-api」，执行「git status」「git worktree list」「git branch --show-current」，记录当前所在分支、工作树是否有未提交修改（用于步骤 10 决定拉取 main 的方式）
2. 执行「git fetch origin develop main」，再用「git rev-list --count origin/main..origin/develop」与「origin/develop..origin/main」确认领先/落后；如果 develop 不领先 main，则中止并向用户报告无需发布
3. 用「gh pr list --base main --head develop --state open」查是否已有 open 的 develop->main PR；如有则记下编号，跳到步骤 6
4. 用「git log --oneline origin/main..origin/develop」提取本次将发布的所有提交，挑出 merge commit 标题与功能型提交主题作为发布内容摘要（重点覆盖 relay、channel、billing、frontend、i18n 等模块的影响范围）
5. 用「gh pr create --base main --head develop --title <release: subject> --body <符合本项目模板的发布说明>」创建 PR，标题统一以「release:」前缀，记下 PR 编号
   - PR body 必须严格使用「.github/PULL_REQUEST_TEMPLATE.md」结构，「📝 变更描述 / Description」中列出本次合入的主要功能、修复与影响范围（含三库兼容、计费、上游 Channel 兼容性等关注点），「🚀 变更类型 / Type of change」按实际勾选，「✅ 提交前检查项 / Checklist」逐条确认勾选
   - 描述必须是人工口吻的中文摘要，禁止粘贴未经整理的 AI 输出；PR 标题与正文中均严禁出现「🤖 Generated with Claude Code」「Generated with Claude Code」等被 anti-slop 拦截的字样
6. 用 TaskCreate 建立监控任务，持续轮询「gh pr view <PR编号> --json state,mergeStateStatus,reviewDecision,statusCheckRollup,labels」，间隔 90 秒，最多等 60 分钟，每轮打印 state/merge/review + 各 check 名称及状态 + 是否被打上「pr-check-failed」标签
7. 任一 check 出现 FAILURE/TIMED_OUT/CANCELLED/ACTION_REQUIRED，或 PR 出现「pr-check-failed」标签、被自动关闭，立即停止轮询：
   - 若是「PR Check」失败（anti-slop，多数源于 PR body 不符合模板或被识别为纯 AI 内容）：用「gh pr edit <PR编号> --title ... --body ...」按模板补全/重写后用「gh pr reopen <PR编号>」重新打开，再次进入轮询
   - 若是代码类失败：develop->main 阶段不在本流程内修复，向用户报告失败原因和「gh run view <runId> --log-failed」结果，由用户决定是回 develop 修还是放弃发布
8. statusCheckRollup 内所有 check 均为 SUCCESS（或本项目当前未配置阻塞型 check 而列表为空）且无失败标签后，再次实测「mergeStateStatus」：CLEAN 视为可合并；BLOCKED 且原因是 review 则向用户报告并等待审批
9. 执行「gh pr merge <PR编号> --merge」合并，随后「gh pr view <PR编号> --json state,mergedAt,mergeCommit」确认 state=MERGED，记录 merge commit oid
10. 根据步骤 1 的当前分支与工作树状态拉取最新 main：
    - 当前已在 main 且工作树干净：「git pull origin main --ff-only」
    - 当前不在 main 但工作树干净：「git fetch origin main && git checkout main && git pull origin main --ff-only」
    - 当前不在 main 且工作树有未提交修改：「git fetch origin main && git branch -f main origin/main」，不切换分支以保留工作树状态
11. 用「git rev-parse main」与「git rev-parse origin/main」对比确认本地 main 已指向最新 commit

## 注意事项
- 这是发布动作，PR 标题统一以「release:」前缀，body 必须列出本次合入的功能项与影响范围，便于事后回溯
- 全程不删除 develop、main 或任何 feature 分支；develop 与 main 都受分支保护
- CI 失败不在本流程内修复：develop->main 的失败几乎都源于 develop 自身问题，应回到 develop 分支修好后重新合入，避免在发布阶段做风险变更
- 严禁修改或删除任何「nеw-аρi」「QuаntumΝоuѕ」相关的项目身份信息，包括 README、license、HTML 标题、footer、模块路径、镜像名等
- 是否需要 approving review 一律以「gh pr view」实测的 reviewDecision/mergeStateStatus 为准，禁止凭文档或经验假设规则
- 禁止使用「gh pr merge --admin」强行绕过分支保护，除非用户明确授权
- 拉取最新 main 时必须先判断当前分支与工作树状态，工作树有暂存/未提交修改时绝不强行 checkout 切分支，用「git branch -f main origin/main」安全更新引用
- 「PR Check」仅在 opened/reopened 触发，重新触发请用「gh pr reopen」或「gh pr ready」，禁止依赖普通 push
- bash 命令中禁止用「timeout ... && python3 ...」串联，timeout 超时退出码 124 会中断 && 链，必须拆成独立两步
- 全程使用中文沟通；轮询脚本输出保持精简，仅在状态变化时打印
