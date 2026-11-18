import Link from 'next/link';
import { PageHeading } from '../../../components/shell';
import { EVENT_LABELS, DEFAULT_RULES } from '../../../domain/rules';
import { database } from '../../../server/db';
import { Button } from '../../../components/ui/button';
import { FileText, Download, ShieldCheck, CalendarCheck2, HeartHandshake } from 'lucide-react';
export default async function Agreement() {
  const settings = await database().setting.findUnique({ where: { id: 1 } });
  return (
    <>
      <PageHeading
        eyebrow="一家人的共同约定"
        title="我们的家庭约定"
        description="规则是为了理解、鼓励和共同成长。修改先在线下讨论，再更新项目。"
      />
      <section className="panel detail-panel agreement-attachment" aria-label="协议附件">
        <div className="section-heading">
          <h2>协议附件</h2>
          <FileText size={22} />
        </div>
        <p>
          <strong>家庭奖惩协议.docx</strong>
        </p>
        <p className="muted small">
          下载的是最初提供的 Word 原件；在线预览为该文件的 PDF 转换版，排版可能略有差异。
        </p>
        <div className="form-actions">
          <Button asChild>
            <a href="/api/agreement-file?format=pdf" target="_blank" rel="noopener noreferrer">
              <FileText size={17} />
              在线查看协议
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href="/api/agreement-file?format=docx" download>
              <Download size={17} />
              下载原始 Word
            </a>
          </Button>
        </div>
        <details style={{ marginTop: 20 }}>
          <summary className="text-link">展开协议预览</summary>
          <iframe
            title="协议 PDF 预览"
            src="/api/agreement-file?format=pdf"
            loading="lazy"
            style={{ width: '100%', height: '70vh', border: 0, marginTop: 12 }}
          />
        </details>
      </section>
      <section className="agreement-principles" aria-label="核心约定">
        <div className="panel">
          <ShieldCheck size={23} />
          <strong>奖励、扣减分别封顶</strong>
          <span>每协议月各 ¥1,000</span>
        </div>
        <div className="panel">
          <CalendarCheck2 size={23} />
          <strong>月度统一核算</strong>
          <span>平时记事实，月底更新钱包</span>
        </div>
        <div className="panel">
          <HeartHandshake size={23} />
          <strong>本人和任一管理员确认</strong>
          <span>创建即确认，异议先沟通</span>
        </div>
      </section>
      <article className="panel prose-panel">
        <h2>记录类型与每次记录</h2>
        <p>
          管理员先定义类型对应的金钱和积分。日常只记录类型、次数、时间和原因，月底按对应表计算。钱包从零开始，补录奖励也通过记录进入结算。
        </p>
        <Link className="text-link" href="/record-types">
          查看与添加记录类型 →
        </Link>
        <h2>怎样记录和结算</h2>
        <p>
          每次只登记事实、时间、原因和次数，大家确认后月底统一计算。金钱奖励与扣减每月分别封顶 1,000
          元；金钱钱包可以为负。
        </p>
        <p>
          协议月起点：{settings?.anchor}
          ，每月沿用原日号。未被其他成员确认的记录可由创建人删除；其他成员确认后不可删除，错误通过关联反向记录纠正。
        </p>
        <h2>金钱规则</h2>
        <table>
          <thead>
            <tr>
              <th>事项</th>
              <th>奖励或扣减</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>学校考试</td>
              <td>A+ +200 元；A +100 元；B -100 元；C -200 元</td>
            </tr>
            <tr>
              <td>基础卷</td>
              <td>≥90 +100 元；80–不足90 不奖不扣；&lt;80 -100 元</td>
            </tr>
            <tr>
              <td>拓展卷</td>
              <td>≥85 +100 元；75–不足85 不奖不扣；&lt;75 -100 元</td>
            </tr>
            <tr>
              <td>对长辈大吼大叫</td>
              <td>确认后每次 -100 元</td>
            </tr>
            <tr>
              <td>学习相关哭泣</td>
              <td>符合协议条件并确认，每次 -100 元</td>
            </tr>
            <tr>
              <td>完整协议月无学习哭泣</td>
              <td>系统查询提出 +500 元候选，总结确认后计算</td>
            </tr>
          </tbody>
        </table>
        <h2>积分规则</h2>
        <p>
          默写全对每次 +1；做家务每天最多 +1；跳过家庭课外试卷每自然月最多一次，每次
          -10。跳过只使用已结算积分，本月未结算奖励不可用。
        </p>
        <h2>共同执行</h2>
        <p>
          先听取解释、沟通核实。哭泣可能是压力和疲劳的信号，应优先帮助平复情绪、解决困难。不得以打骂、羞辱、威胁或剥夺基本生活需要执行约定。
        </p>
        <p className="muted small">
          项目规则修订：{DEFAULT_RULES.revision} · 当前显示项目配置，历史结算保存当时规则快照。
        </p>
      </article>
    </>
  );
}
