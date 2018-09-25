'use strict';

/**
 *
 * @param {Array} tagReport - should be the tag data received from /wiser/api/passivetagreport
 *
 * Sorts the tag rerpot by timestamp, in ascending order, and removes duplicate tag ID entries so that only the most current tag data is in the report. Manipulates the source tagReport array.
 */
function uniqueFilterTagReport(tagReport) {
  // sort ascending
  tagReport.sort((a, b) => {
    return a.timestamp <= b.timestamp ? -1 : 1;
  });

  let unique = {};

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
function getZoneTransitions(lastIdList = [], nextIdList = []) {
  let enter, exit;

  enter = nextIdList.filter(id => {
    return lastIdList.indexOf(id) === -1;
  });
  exit = lastIdList.filter(id => {
    return nextIdList.indexOf(id) === -1;
  });

  return { enter, exit };
}

module.exports = {
  uniqueFilterTagReport,
  getZoneTransitions
};
