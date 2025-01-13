// 2024-12-10T21:50:06.355Z
export const isValidISO8601 = (dateString: string): boolean => {
  const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
  return iso8601Regex.test(dateString)
}
