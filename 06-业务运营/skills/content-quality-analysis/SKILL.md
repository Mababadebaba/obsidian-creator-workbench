---
name: content-quality-analysis
description: Use when the user explicitly asks to analyze, diagnose, score, compress, or refine a draft/script in this content project, especially requests like "分析最新稿", "看看文稿质量", "能不能发", "有没有戳中人", "压缩文稿", "去废话", "精炼", or "提高单位信息密度". Combines dbs-resonate/dbs-content with concept compression and cheat-score for 5-10 minute video scripts; it is a diagnostic tool, not a mandatory writing gate.
---

# Content Quality Analysis

## Purpose

This is the project's standard draft-analysis flow. It prevents re-explaining preferences every time:

- Default format: 5-10 minute Chinese video script.
- Default target: the newest `scripts/*.md` file when no path is given.
- Default output: diagnosis, rewrite priorities, and direct replacements for redundant sentence clusters, not a fully rewritten draft.
- Compression-mode output: when the user explicitly asks to compress/refine the draft, include the complete compressed draft after the replacement log.
- Default side effect: none. Do not write predictions, scores, or state unless explicitly asked.

## Source Skills

Use the vendored dbskill copies first:

- `06-业务运营/skills/dbs-resonate/SKILL.md`
- `06-业务运营/skills/dbs-content/SKILL.md`
- `06-业务运营/skills/dbs-ai-check/SKILL.md` (AI-味诊断；默认只诊断)

Use project methods as required:

- `05-方法论沉淀/方法论证据分层与来源审计规范.md` for distinguishing source claims, system-derived heuristics, cross-sample observations, account validation, and project rules.
- `rubric_notes.md` for `cheat-score` dimensions.
- `05-方法论沉淀/短视频开头方法论.md` for HP / opening.
- `05-方法论沉淀/短视频文案节奏方法论（时钟理论）.md` for long-video rhythm.
- `05-方法论沉淀/爆款内容三要素方法论.md` for Nana's L1 source claims about scarcity / altruism / density; treat the author's 500+ sample statement as self-report, not account validation.
- `05-方法论沉淀/爆款口播内容设计方法论.md` for body structure: story unit + density layering + 首句可懂性/句间增量 + escalation (推力) — the "why keep watching段2→段5" layer that 时钟理论 does not cover.
- `05-方法论沉淀/文稿概念压缩方法论.md` for sentence-cluster semantic deduplication, concept naming, and fidelity-preserving replacement copy. This is an action layer, not a score.
- `05-方法论沉淀/传播心理学与爆款方法论.md` for one creator's L1 interpretation of propagation psychology; do not present its six principles, emotion ranking, quotations, or cited theories as independently verified scholarship.
- `script_patterns.md` and `benchmark.md` for local pattern matching.

## Workflow

### 0. Select the requested mode

- **Diagnostic mode**: use the full report when the user explicitly asks to analyze or score a draft.
- **Compression mode**: include the replacement log and complete compressed draft when the user explicitly asks to compress or refine it.

Do not invoke this Skill automatically just because a draft was generated. Writing, benchmark imitation, voice reconstruction, and quality diagnosis are separate tasks. When calibration is still cold-start, treat scores as observations rather than traffic predictions.

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

- **Source fidelity first**: before applying a method, label it L1 source restatement, L2 system heuristic, L3 cross-sample observation, L4 account result, or O project rule. If the draft imitates a specific benchmark, compare the actual source passage with the target paragraph before using generalized labels; check the visible sentence shape, clause order, connectors and factual substitutions rather than a tournament or score.
- **Opening**: classify the first 3-5 seconds using the six candidate opening types. Treat the classification as L2 and cite actual benchmark wording when a specific structure is claimed.
- **Clock rhythm**: divide the target duration into 12 clock-tick zones, then use 3/6/9/12 as macro checkpoints. Identify empty zones and the system's >15% review alert, explicitly labeling both as L2 heuristics rather than validated thresholds.
- **口播结构 (爆款口播)**: the body-structure layer, distinct from clock rhythm. The source video directly proposed story, information density, and push structure (L1); the following operational tests are L2 extensions. Check four things — (a) evidence carrier: does a viewpoint need a story, case, data, comparison, or demonstration, and is the chosen proof complete enough; do not require every viewpoint to use the same five-part story; (b) information layering: how many real progression points exist, whether each has evidence, and whether a memorable summary is useful; 3-7 points is a prompt, not a rule; (c) 首句可懂性 × 句间增量: 遮住抽象句后两句，首句能否被目标观众第一次听懂；后句是否新增理由/证据/例子/边界/动作/情绪/转折。若后句只有同义释义，重写首句并删除补救性解释；不要把必要案例、操作步骤或个人语气误判为废话; (d) push: identify what concrete question or expectation carries the viewer onward; amount/ability/problem ladders are examples, not mandatory forms. Keep this SEPARATE from clock rhythm.
- **句群概念压缩**: do not stop at sentence-level increment checks. Group 2-8 sentences that perform one semantic task, extract K/M/E/B/A/V/R roles, merge R (repeat/paraphrase), name the stable mechanism/distinction/constraint/decision variable, and write direct replacement copy. This asks "同一个意思用了几句话，能否压成一个精确概念 + 最小证明".
- **Three elements**: use scarcity, altruism, and information density as Nana-derived L1 prompts, not mandatory ingredients or validated scoring dimensions.
- **Benchmark fit**: identify matching patterns from `script_patterns.md` / `benchmark.md`.

For a 5-10 minute script, judge whether each clock-tick zone provides new information, visual proof, emotional escalation, or a suspense/transition beat. The 3/6/9/12 marks are macro structure checkpoints, not the only rhythm units.

Every diagnosis must distinguish:

- what the external source literally proposed;
- what this project added for execution;
- what appears repeatedly in benchmark samples;
- what this account's data has actually supported.

### 5. Perform sentence-cluster concept compression

Apply `文稿概念压缩方法论` after the structure diagnosis and before scoring:

1. Segment the entire draft into minimal semantic clusters of 2-8 sentences. A cluster answers one main question, even if it crosses paragraph boundaries.
2. For each candidate cluster, tag the atomic functions: K (core claim), M (mechanism), E (evidence), B (boundary), A (action), V (voice/emotion/transition), R (repeat/paraphrase).
3. Classify it: A = 3+ sentences carrying only one unique proposition or obvious remedial explanation; B = partial overlap that can be merged without loss; C = low semantic increment but possibly functional voice/rhythm.
4. For every A cluster and every high-impact B cluster, produce:
   - the one semantic kernel;
   - a precise concept that names a mechanism, distinction, constraint, decision variable, stage change, or cost;
   - copy that can directly replace the original cluster;
   - what was deleted as R and what was preserved as K/M/E/B/A/V.
5. Validate 100% retention of necessary propositions. Do not create new causality, erase evidence/boundaries, or turn plain speech into invented jargon.

This is a rewrite action, not a density score. Never output only "这里冗余 / 建议精简". The user must receive actual replacement wording.

For a normal quality-analysis request, include direct replacements for all A and high-impact B clusters, but do not rewrite the whole draft. For explicit requests such as "压缩文稿 / 去废话 / 精炼 / 提高单位信息密度 / 概念化", enter compression mode and append the complete compressed draft. Do not save or overwrite a file unless the user explicitly asks.

### 6. Run cheat-score last

Use the current `rubric_notes.md` dimensions:

- ER
- HP
- QL
- NA
- AB
- SR
- SAT

Give integer scores only. Treat the score as a diagnostic, not a publish prediction. Do not write to `predictions/`.

### 7. AI-味诊断

Apply the local `dbs-ai-check` workflow when the user asks for AI-writing diagnosis or when it is part of the requested full analysis. Scan for AI-generated fingerprints (模板化排比、空泛副词、"不仅…而且"、总分总套路、无主语判断句、过度对仗) that flatten共鸣 and口播真实感. Diagnosis only — flag the exact sentences, do not rewrite unless asked.

### 8. Output format

For diagnostic mode, use this exact order:

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
- 证据承载（故事/案例/数据/对比/演示；所选证据是否完整）：
- 信息密度分层（推进点数 / 是否配证据 / 段尾金句）：
- 首句可懂性 × 句间增量（补救性解释 / 必要解释 / 可合并句群）：
- 推力阶梯（每段是否更值钱 / 删「看到最后」是否仍留人）：

## 句群概念压缩（直接可替换）
- 候选句群：A 级 __ 处 / B 级 __ 处 / C 级 __ 处
| 位置 | 级别 | 原句群的唯一意思 | 精确概念 | 可直接替换的压缩稿 | 删除 / 保留依据 |
|---|---|---|---|---|---|

## cheat-score 粗打分
| 维度 | 分 | 理由 |

## AI-味诊断（dbs-ai-check）
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
- Do not confuse shorter wording with better compression. Preserve every necessary proposition and all evidence/boundaries; delete only R, then name the relationship precisely.
- Do not manufacture labels such as "某某力 / 某某思维 / 底层逻辑" unless the label names a real, defined relationship and reduces future explanation cost.
- Do not merely diagnose sentence clusters. Every A and high-impact B cluster must receive direct replacement copy.
- Do not collapse all methods into one vague analysis. Keep dbs-resonate, dbs-content, project rhythm, and cheat-score as separate layers.
- Do not rename a source concept and continue attributing the renamed framework to the source. Mark every new formula, threshold, scorecard, or checklist as L2 unless evidence supports a higher level.
- Do not predict traffic unless the user explicitly asks for `cheat-predict`.
