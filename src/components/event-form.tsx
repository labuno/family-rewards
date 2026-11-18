'use client';
import { useState } from 'react';
import { Save, Info } from 'lucide-react';
import { EVENT_LABELS, SHOUT_TARGETS, rate, type Rules } from '../domain/rules';
import { Impact } from './impact';
import { CommandForm } from './command-form';
import { Button } from './ui/button';
import { typeMatchesAsset, type Asset } from '../domain/assets';
export function EventForm({
  subjectId,
  requestKey,
  defaultType,
  defaultTime,
  types,
  rules,
  asset,
}: {
  rules: Rules;
  asset?: Asset;
  types: { code: string; name: string }[];
  subjectId: string;
  requestKey: string;
  defaultType: string;
  defaultTime: string;
}) {
  const [type, setType] = useState(defaultType || 'CHORE');
  const [grade, setGrade] = useState('A+');
  const [score, setScore] = useState('');
  const [quantity, setQuantity] = useState('1');
  const exam = ['SCHOOL', 'BASIC', 'ADVANCED'].includes(type);
  const needsScore = ['BASIC', 'ADVANCED'].includes(type);
  const validQuantity =
    Number.isInteger(Number(quantity)) &&
    Number(quantity) >= 1 &&
    Number(quantity) <= (['CHORE', 'SKIP'].includes(type) ? 1 : 1000);
  const validScore = !needsScore || (score !== '' && Number(score) >= 0 && Number(score) <= 100);
  const impact =
    validQuantity && validScore
      ? rate(type, JSON.stringify({ grade, score: Number(score) }), rules)
      : null;
  return (
    <CommandForm className="event-form">
      <input type="hidden" name="action" value="record" />
      <input type="hidden" name="subjectId" value={subjectId} />
      <input type="hidden" name="requestKey" value={requestKey} />
      <div className="form-grid">
        <div>
          <label htmlFor="type">事项类型</label>
          <select id="type" name="type" value={type} onChange={(e) => setType(e.target.value)}>
            {[
              ...Object.entries(EVENT_LABELS).filter(([key]) => key !== 'REVERSAL'),
              ...types.map((t) => [t.code, t.name]),
            ]
              .filter(([key]) => !asset || typeMatchesAsset(key, asset, rules))
              .map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label htmlFor="occurredAt">发生时间</label>
          <input
            id="occurredAt"
            name="occurredAt"
            type="datetime-local"
            defaultValue={defaultTime}
            required
          />
        </div>
        {type === 'SCHOOL' && (
          <div>
            <label htmlFor="grade">成绩等级</label>
            <select
              id="grade"
              name="grade"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
            >
              <option>A+</option>
              <option>A</option>
              <option>B</option>
              <option>C</option>
            </select>
          </div>
        )}
        {['BASIC', 'ADVANCED'].includes(type) && (
          <div>
            <label htmlFor="score">试卷分数</label>
            <input
              id="score"
              name="score"
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={score}
              onChange={(e) => setScore(e.target.value)}
              required
            />
          </div>
        )}
        <div>
          <label htmlFor="quantity">次数</label>
          <input
            id="quantity"
            name="quantity"
            type="number"
            min="1"
            max={['CHORE', 'SKIP'].includes(type) ? 1 : 1000}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
        </div>
        {type === 'SHOUT' && (
          <div>
            <label htmlFor="shoutTarget">对象</label>
            <select id="shoutTarget" name="shoutTarget" defaultValue="" required>
              <option value="" disabled>
                请选择对象
              </option>
              {SHOUT_TARGETS.map((target) => (
                <option key={target}>{target}</option>
              ))}
            </select>
          </div>
        )}
        {exam && (
          <div>
            <label htmlFor="schoolYear">年级</label>
            <select id="schoolYear" name="schoolYear" defaultValue="" required>
              <option value="" disabled>
                请选择年级与学期
              </option>
              {['一', '二', '三', '四', '五', '六'].flatMap((year) =>
                ['上', '下'].map((term) => {
                  const label = year + '年级' + term;
                  return <option key={label}>{label}</option>;
                }),
              )}
            </select>
          </div>
        )}
        <div className="full-width">
          <label htmlFor="reason">事项原因</label>
          <textarea
            id="reason"
            name="reason"
            placeholder="写下发生了什么，以及需要一起确认的依据…"
            rows={4}
            maxLength={1000}
            required
          />
        </div>
      </div>
      <div className="event-preview" role="status" aria-label="本次预计变化" aria-live="polite">
        <div>
          <span className="small">本次预计变化</span>
          <strong>
            {impact ? (
              <Impact
                money={impact.money * Number(quantity)}
                points={impact.points * Number(quantity)}
                zeroLabel="金额和积分均无变化"
              />
            ) : needsScore && !validScore ? (
              '请填写试卷分数（0–100）'
            ) : (
              '请填写有效次数'
            )}
          </strong>
        </div>
        <p>按当前协议计算，金额奖励与扣减每协议月各封顶 1,000 元，最终以月度总结为准。</p>
      </div>
      {type === 'SKIP' && (
        <div className="notice">
          <Info size={18} />
          <span>
            每自然月最多一次，使用 10 个已结算积分币。本月未结算奖励不可用，钱包月底统一更新。
          </span>
        </div>
      )}
      <div className="form-actions">
        <p className="muted small">只登记事实，不立即改变钱包余额。</p>
        <Button type="submit">
          <Save size={17} />
          保存记录
        </Button>
      </div>
    </CommandForm>
  );
}
