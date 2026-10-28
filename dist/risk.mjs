// Prototype display thresholds only; no sinking probability or certified stability judgment.
export function evaluateRisk({metrics:m,levels,threshold,instant}){
 const reasons=[];let severity=0;const add=(level,code,text)=>{severity=Math.max(severity,level);reasons.push({code,text,level});};
 const fmt=v=>Number.isFinite(v)?v.toFixed(2):'미계산';
 if(!m||!m.valid||!Number.isFinite(m.gm)||m.gm<=.2)add(3,'gm-invalid',`추정 GM ${fmt(m?.gm)}m · 계산 조건 > 0.20m를 충족하지 않습니다.`);
 if(!m||!Number.isFinite(m.heel)||!Number.isFinite(instant)||!Number.isFinite(m.mass)||m.mass<=0||!Number.isFinite(m.trim)||!Number.isFinite(threshold)||threshold<.1||threshold>10)add(3,'calculation-invalid','기울기·질량·환경 또는 시연 한도를 유효한 수치로 계산할 수 없습니다.');
 if(!Array.isArray(levels)||levels.length!==4||levels.some(v=>!Number.isFinite(v)||v<0||v>1200))add(3,'tank-invalid','탱크 수량이 가정 용량 0–1200t 또는 유효한 수치 범위를 벗어났습니다.');
 if(m?.valid&&Number.isFinite(m.gm)&&m.gm>.2&&m.gm<.5)add(1,'gm-low',`추정 GM ${fmt(m.gm)}m · 가정 주의 구간 0.20–0.50m입니다.`);
 if(Number.isFinite(m?.heel)&&Number.isFinite(threshold)&&threshold>0){const a=Math.abs(m.heel);if(a>threshold)add(2,'heel-high',`하역 기울기 ${fmt(a)}°가 시연 한도 ${fmt(threshold)}°를 초과했습니다.`);else if(a>=threshold*.8-1e-9)add(1,'heel-near',`하역 기울기가 시연 한도의 80% 이상입니다 (${fmt(a)}°).`);}
 if(Number.isFinite(instant)&&Number.isFinite(threshold)&&threshold>0){const a=Math.abs(instant);if(a>threshold)add(2,'instant-high',`파도를 합친 순간 기울기 ${fmt(a)}°가 시연 한도를 초과했습니다.`);else if(a>=threshold*.8-1e-9)add(1,'instant-near',`파도를 합친 순간 기울기가 시연 한도의 80% 이상입니다 (${fmt(a)}°).`);}
 if(Array.isArray(levels)&&levels.length===4&&levels.every(Number.isFinite)){const names=['좌현 선수','우현 선수','좌현 선미','우현 선미'];for(let i=0;i<4;i++)if(levels[i]<80||levels[i]>1120)add(2,'tank-range',`${names[i]} ${levels[i].toFixed(1)}t · 가정 운전 범위 80–1120t 밖입니다.`);}
 const labels=['기준 내','주의','기준 초과','계산 범위 밖'],colors=['#63e4c0','#f2c46e','#ff8e68','#ff657b'];
 const signed=Number.isFinite(m?.heel)&&Number.isFinite(instant)?(Math.abs(instant)>Math.abs(m.heel)?instant:m.heel):null;
 const side=severity===3?0:Math.abs(signed??0)<.01?0:Math.sign(signed);
 return {severity,label:labels[severity],color:colors[severity],stop:severity===3,reasons,side,direction:severity===3?'방향 산정 불가':side<0?'좌현':side>0?'우현':'좌우 편차 작음',guidance:severity===3?'하역·이송을 중지했습니다. 선체 자세는 마지막 유효 상태를 유지합니다. 화물·탱크·환경 입력을 검토하고 유효한 조건을 다시 적용하세요.':severity===2?'일시정지 후 하역 순서·화물 배치와 가능한 평형수 조정안을 확인하세요.':severity===1?'기울기와 탱크 수량을 관찰하고 운전 추천을 확인하세요.':'현재 표시한 항목은 가정 기준 이내입니다. 실제 안전을 보장하지 않습니다.'};
}
