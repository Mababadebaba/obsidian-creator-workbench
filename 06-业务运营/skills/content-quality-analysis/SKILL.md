---
name: content-quality-analysis
description: Use when analyzing a draft/script quality in this content project, especially requests like "分析最新稿", "看看文稿质量", "能不能发", "有没有戳中人", or when combining dbs-resonate/dbs-content with cheat-score for 5-10 minute video scripts.
---

# Content Quality Analysis

## Purpose

This is the project's standard draft-analysis flow. It prevents re-explaining preferences every time:

- Default format: 5-10 minute Chinese video script.
- Default target: the newest `scripts/*.md` file when no path is given.
- Default output: diagnosis and rewrite priorities, not a rewritten draft.
- Default side effect: none. Do not write predictions, scores, or state unless explicitly asked.

## Source Skills

Use the vendored dbskill copies first:

- `06-业务运营/skills/dbs-resonate/SKILL.md`
- `06-业务运营/skills/dbs-content/SKILL.md`
- `06-业务运营/skills/dbs-ai-check/SKILL.md` (pre-publish AI-味 gate; diagnosis only)

Use project methods as required:

- `rubric_notes.md` for `cheat-score` dimensions.
- `05-方法论沉淀/短视频开头方法论.md` for HP / opening.
- `05-方法论沉淀/短视频文案节奏方法论（时钟理论）.md` for long-video rhythm.
- `05-方法论沉淀/爆款内容三要素方法论.md` for scarcity / altruism / density.
- `05-方法论沉淀/爆款口播内容设计方法论.md` for body structure: story unit + density layering + 首句可懂性/句间增量 + escalation (推力) — the "why keep watching段2→段5" layer that 时钟理论 does not cover.
- `05-方法论沉淀/传播心理学与爆款方法论.md` for resonance and propagation psychology.
- `script_patterns.md` and `benchmark.md` for local pattern matching.

## Workflow

### 1. Resolve the draft

If the user gives a path, use it. Otherwise pick the newest `scripts/*.md`.

For this project, do not treat 5-10 minutes as too long. Check whether the script fits the target range, then analyze pacing for that range.

### 2. Run dbs-resonate first

Apply the local `dbs-resonate` workflow:

1. List all explicit or implicit claims.
2. Identify the one core mechanism.
3. Mark whether the core is clear, diluted, or unclear.
4. Diagnose five resonance dimensions:
   - silent-breaking
   - motivation satisfaction
   - stance frame
   - propagation entry
   - belief structure
5. Give concrete edits: delete, compress, strengthen, keep.

This is the highest-priority layer. If the core is diluted, say that before discussing scores.

### 3. Run dbs-content second

Apply the local `dbs-content` workflow:

1. Confirm recommended form and platform.
2. Diagnose:
   - text hygiene
   - title / cover
   - expression efficiency
   - cognitive gap
   - AI-assisted production workflow
3. Give the first concrete production action.

For tool/tutorial videos, always check whether real screen recording or evidence is required to support the claim.

### 4. Add project video-analysis layers

Use the project methods to add:

- **Opening**: classify the first 3-5 seconds using the five opening types.
- **Clock rhythm**: divide the target duration into 12 clock-tick zones, then use 3/6/9/12 as macro checkpoints. Identify empty zones and hard cold zones.
- **口播结构 (爆款口播)**: the body-structure layer, distinct from clock rhythm. Check four things — (a) 故事单元完整度: does each viewpoint carry a 人物/冲突/选择/结果/回扣 unit, and does it 回扣 the viewpoint immediately; (b) 信息密度分层: 观点层是否 3-7 个推进点 / 每点是否配证据(故事·案例·数据·对比) / 段尾是否有可独立传播的金句; (c) 首句可懂性 × 句间增量: 遮住抽象句后两句，首句能否被目标观众第一次听懂；后句是否新增理由/证据/例子/边界/动作/情绪/转折。若后句只有同义释义，重写首句并删除补救性解释；不要把必要案例、操作步骤或个人语气误判为废话; (d) 推力阶梯: 是否用金额/能力/问题阶梯让每段比上段"更值得看"，删掉"看到最后"后结构本身是否仍留人. Keep this SEPARATE from clock rhythm — clock asks "每段有没有东西", this asks "这些东西是否由故事承载、能否直接听懂、句句有增量、逐级递进".
- **Three elements**: scarcity, altruism, information density.
- **Benchmark fit**: identify matching patterns from `script_patterns.md` / `benchmark.md`.

For a 5-10 minute script, judge whether each clock-tick zone provides new information, visual proof, emotional escalation, or a suspense/transition beat. The 3/6/9/12 marks are macro structure checkpoints, not the only rhythm units.

### 5. Run cheat-score last

Use the current `rubric_notes.md` dimensions:

- ER
- HP
- QL
- NA
- AB
- SR
- SAT

Give integer scores only. Treat the score as a diagnostic, not a publish prediction. Do not write to `predictions/`.

### 6. AI-味 gate (发布前，最后一道)

Apply the local `dbs-ai-check` workflow as a pre-publish hygiene gate. Because scripts here are AI-assisted, scan for AI-generated fingerprints (模板化排比、空泛副词、"不仅…而且"、总分总套路、无主语判断句、过度对仗) that flatten共鸣 and口播真实感. Diagnosis only — flag the exact sentences, do not rewrite unless asked. This is a gate, not a score: output a short 命中清单 + 改写方向, not a number.

### 7. Output format

Use this exact order:

```markdown
## 一句话结论

## 核心机制审查
- 文稿主张：
- 真正核心：
- 当前问题：

## dbs-resonate 共鸣诊断
| 维度 | 判断 | 依据 |

## dbs-content 内容诊断
| 维度 | 判断 | 依据 |

## 长视频节奏诊断
- 目标时长：
- 12 刻度区：
- 3/6/9/12 大节点：
- 冷区：
- 需要画面证明的段落：

## 口播结构诊断（爆款口播）
- 故事单元（人物/冲突/选择/结果/回扣）：
- 信息密度分层（推进点数 / 是否配证据 / 段尾金句）：
- 首句可懂性 × 句间增量（补救性解释 / 必要解释 / 可合并句群）：
- 推力阶梯（每段是否更值钱 / 删「看到最后」是否仍留人）：

## cheat-score 粗打分
| 维度 | 分 | 理由 |

## AI-味 gate（dbs-ai-check）
- 命中句（逐句列）：
- 改写方向：

## 改稿优先级
1. 必改：
2. 可压缩：
3. 保留：
4. 可拆成下一条：
```

## Non-Negotiables

- Do not start with generic praise.
- Do not only say "增强共鸣" or "节奏更紧"; point to exact paragraphs or sentences.
- Do not treat all explanations or口语表达 as waste. Compress only when a later sentence merely translates an unclear earlier sentence and adds no reason, evidence, example, boundary, action, emotion, or transition.
- Do not collapse all methods into one vague analysis. Keep dbs-resonate, dbs-content, project rhythm, and cheat-score as separate layers.
- Do not predict traffic unless the user explicitly asks for `cheat-predict`.
