function score(record, target) {
  let value = (record.decayScore || 0) * 100 + (record.confidence || 0) * 10;
  if (record.agent && record.agent === target.agent) {
    value += 1000;
  }
  if (record.stage && record.stage === target.stage) {
    value += 100;
  }
  return value;
}

function queryAgentMemories(records, { agent, stage, limit = 3 } = {}) {
  return records
    .filter((record) => {
      if (record.stage != null && stage != null && record.stage !== stage) {
        return false;
      }
      if (record.agent && record.agent !== agent) {
        return false;
      }
      return true;
    })
    .sort((left, right) => score(right, { agent, stage }) - score(left, { agent, stage }))
    .slice(0, limit);
}

export {
  queryAgentMemories
};
