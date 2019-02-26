import { Tag } from './types';

/**
 *
 * @param {Array} tagReport - should be the tag data received from /wiser/api/passivetagreport
 *
 * Sorts the tag rerpot by timestamp, in ascending order, and removes duplicate tag ID entries so that only the most current tag data is in the report. Manipulates the source tagReport array.
 */
function uniqueFilterTagReport(tagReport: Tag[]) {
  // sort ascending
  tagReport.sort((a, b) => {
    return a.timestamp <= b.timestamp ? -1 : 1;
  });

  let unique: { [prop: string]: boolean } = {};

  // remove out-of-date duplicates
  for (let i = tagReport.length - 1; i > -1; i--) {
    if (unique[tagReport[i].tag]) {
      tagReport.splice(i, 1);
    } else {
      unique[tagReport[i].tag] = true;
    }
  }
}

/**
 *
 * @param {Array} lastIdList - the last list of zone IDs a tag was in
 * @param {Array} nextIdList - the next list of zone IDs a tag is in
 * @returns {Object}
 *
 * Returns an Object {enter: [id...], exit: [id...]} describing what transitions occured
 */
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
