import { Tag } from './types';

function uniqueFilterTagReport(tagReport: Tag[]): Tag[] {
  const result = [];
  let unique: { [prop: string]: boolean } = {};
  tagReport.sort((a, b) => {
    return a.timestamp >= b.timestamp ? -1 : 1;
  });
  tagReport.forEach(tag => {
    if (unique[tag.tag]) return;
    result.push(tag);
    unique[tag.tag] = true;
  });
  return result;
}

function getZoneTransitions(
  lastIdList: number[],
  nextIdList: number[]
): { enter: number[]; exit: number[] } {
  const enter: number[] = nextIdList.filter(
    id => lastIdList.indexOf(id) === -1
  );
  const exit: number[] = lastIdList.filter(id => nextIdList.indexOf(id) === -1);
  return { enter, exit };
}

export { uniqueFilterTagReport, getZoneTransitions };
