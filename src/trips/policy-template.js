// Local reusable defaults, not an authenticated corporate policy service.
export function tripPolicyFromTemplate(template) {
  if (!template?.rules) return undefined;
  const { exceptionReason, ...rules } = template.rules;
  return { ...JSON.parse(JSON.stringify(rules)), templateVersion: template.version };
}
