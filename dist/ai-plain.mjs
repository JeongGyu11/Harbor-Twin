// Safety net for AI text shown to users: turn leftover code names, markdown and
// symbols into plain Korean. The server prompt already asks for plain language;
// this catches the occasional slip so the screen stays readable.
const TERMS=[
 ['instantHeelWithWavesDeg','파도를 합친 기울기'],['peakWithWavesDeg','파도를 합친 최대 기울기'],['peakHeelDeg','최대 기울기'],['finalHeelDeg','마지막 기울기'],
 ['predictedHeelDeg','예상 기울기'],['heelDeg','기울기'],['peakDeg','최대 기울기'],['finalDeg','마지막 기울기'],['thresholdDeg','시연 한도'],['threshold','시연 한도'],
 ['gmM','복원력(GM)'],['forecast60s','60초 예측'],['secondsOverThreshold','한도를 넘은 시간'],['withoutTransfer','물을 옮기지 않을 때'],
 ['bestTransferByModel','모델이 추천한 이송'],['evaluatedTransfer','확인한 이송'],['transferInProgress','진행 중인 이송'],['recommendation','추천 이송'],
 ['modelVerdict','판단'],['unloadIntervalS','하역 간격'],['unloadInterval','하역 간격'],['pumpRateTps','펌프 속도'],['movedT','옮긴 물 양'],
 ['containersUnloaded','내린 컨테이너'],['containersTotal','전체 컨테이너'],['amountT','이송량'],['durationS','걸리는 시간'],['windMps','풍속'],
 ['waveHeightM','파고'],['wavePeriodS','파도 주기'],['windFromDeg','바람 방향'],['waveFromDeg','파도 방향'],['shipHeadingDeg','배 방향'],
 ['nextUnload','다음 하역 화물'],['simulate_what_if','가상 시뮬레이션'],
];
export function plainText(input){
 let t=String(input??'');
 t=t.replace(/[‐-–−]/g,'-');                      // odd hyphens/minus signs used by some models
 t=t.replace(/```[\s\S]*?```/g,'').replace(/`([^`]*)`/g,'$1');    // code blocks / inline code
 t=t.replace(/\*\*(.+?)\*\*/g,'$1').replace(/__(.+?)__/g,'$1');   // bold markers
 t=t.replace(/^\s*#{1,6}\s*/gm,'');                              // markdown headings
 t=t.replace(/^\s*\|.*\|\s*$/gm,'');                            // table rows
 for(const [code,word] of TERMS)t=t.replace(new RegExp(`\\b${code}\\b`,'g'),word);
 t=t.replace(/\b[a-z]+(?:[A-Z][a-z0-9]*)+\b/g,'');             // any other camelCase identifier
 t=t.replace(/\b([PS])-([FA])\s*(?:→|->|=>)\s*([PS])-([FA])\b/g,'$1-$2에서 $3-$4로'); // tank arrows
 t=t.replace(/\s*(?:→|->|=>)\s*/g,', 그러면 ');                   // other arrows
 t=t.replace(/±\s*/g,'');
 t=t.replace(/(\d)\s*°/g,'$1도');
 t=t.replace(/(\d)\s*t\b/g,'$1톤');
 t=t.replace(/(\d)\s*s\b(?!\/)/g,'$1초');
 t=t.replace(/[ \t]{2,}/g,' ').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').replace(/\(\s*\)/g,'');
 return t.trim();
}
