# 七上单元词汇核对：未通过完整教材词库验收

日期：2026-11-06。审计对象为 gh-pages 提交 40859a94a21e7ab409a2021c24ec457439b490d9；部署运行 42195376840；实际下载产物 13491637099。本次仅登记审计，没有修改正式课程数据、缓存或学生记录。

## 证据边界

教材参照为公开托管的教材文本副本：版权页为2024年7月第1版、2025年7月第2次印刷。对照印刷页149词表及14—16页课内语境；不是本次从国家平台导出的官方文件，也没有核实2026更新印次。用户截图只确认册别、新教材标签和目录。

参照：https://www.scribd.com/document/942953797/2025改版-课本-译林版英语七年级上册
上轮第三方默写表：https://zy.21cnjy.com/20714131
用法核对：https://www.oxfordlearnersdictionaries.com/us/definition/english/go-by

## Unit 1

现有45项，程序标记41项教材词/短语、4项拓展。按参照本本单元新词表逐项比对，忽略sth后缩写点，40项均已有对应。另5项 quiet、favourite、name、new、maths 也出现在本单元正文，不能说成教材没有或机械删除。应区分新词表成员与课内复现/辅助词。

重点差异：fun 当前只有名词用法，但参照本本单元为形容词用法；stay需明确本课系动词用法；ready漏掉愿意做事的语境；problem需体现数学题语境。full、enjoy也需精化。音标和发音未完成审校。

站内go by例句“My friends go by my English name at school.”的主语指向不符合原教学意图。建议原创替换为“I go by Alex at school.”，尚未应用。

## 判题实测

在独立合成状态中实际运行当前word-study-core.js：标准答案be ready to do sth.；输入无末尾点的be ready to do sth，correct=false；输入带点形式，correct=true。需建立缩写/占位符规则，不能以清空记录解决。

旧8项排在数组前面，greet排第9。保留稳定编号正确，但教材展示顺序应与存储编号分离。还应保留教材星号词的认读/拼写要求。

## 全册盘点

Unit 1为45项；Unit 2—8各8项，均未完成教材新词表覆盖。本轮没有宣称其余7单元逐条释义审校完成。

## 实际部署产物不一致

- 根目录curriculum-data.js：数据v3.8，Unit 1为45项。
- downloads/jiangsu-english-offline.html：数据v3.7，Unit 1为8项。
- downloads/jiangsu-english-complete.zip中的English-Learning/index.html：数据v3.7，Unit 1为8项。
- sw.js的43项核心资源中，3项校验值和字节数与实际文件不符：curriculum-data.js（清单350940/实际367995字节）、curriculum-app.js（61261/62205）、word-study-app.js（16241/16738）。

当前文件SHA-256：
- curriculum-data.js: f6198c3a8d15eabb476a444c9e0627ad83a779f3b25e9aa45f28fd70b2d0b388
- curriculum-app.js: e35b3dbf92199bef71cd750b5da17e9e96a67fbcedcea6847b18e3c245a00790
- word-study-app.js: 407a275f0b207d0e75285449e312ac10dcbcd3e7693657a4360cb6dc359c714e

这证明不同发布入口内容不一致；实际设备命中哪个版本仍取决于缓存状态。不能保证刷新就解决，不应让用户清除可能包含学习记录的站点数据。

## 测试解释与处理顺序

本轮重新运行原Python4项和Node学习记录测试，均通过；但它们只验证既定数量、编号及存储，不证明教材语义和离线一致性。

应先校正Unit 1分类、语境、例句和判题，再从同一数据源重新生成在线/离线文件及缓存清单，复测旧记录保留、断网重启与词汇一致性。官方原页、2026印次、全册音标及其余单元仍待进一步核验。

状态：仅审计登记；未发布修复。
