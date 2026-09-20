export function taxReviewProgress(keys, responses) {
  const answers = {}, uncertain = [];
  for (const key of keys) {
    if (typeof responses[key] === 'boolean') answers[key] = responses[key];
    else if (responses[key] === 'unknown') uncertain.push(key);
  }
  const answered = Object.keys(answers).length + uncertain.length;
  return { answered, total: keys.length, complete: answered === keys.length, uncertain, answers };
}
