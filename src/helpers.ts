import { Tag } from './types';

function uniqueFilterTagReport(tagReport: Tag[]) {
  tagReport.sort((a, b) => {
    return a.timestamp <= b.timestamp ? -1 : 1;
  });
  let unique: { [prop: string]: boolean } = {};
  for (let i = tagReport.length - 1; i > -1; i--) {
    if (unique[tagReport[i].tag]) {
      tagReport.splice(i, 1);
    } else {
      unique[tagReport[i].tag] = true;
    }
  }
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
