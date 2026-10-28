type ErrorResponse = {
  response?: {
    status?: number
    data?: { error?: string; msg?: string }
  }
}

export const responseStatus = (error: unknown): number | undefined => {
  return (error as ErrorResponse)?.response?.status
}

export const isUncertainRequestError = (error: unknown): boolean => {
  const status = responseStatus(error)
  if (status === undefined) return true
  return status === 408 || status >= 500
}

export const apiErrorText = (error: unknown, fallback = ''): string => {
  const response = (error as ErrorResponse)?.response
  switch (response?.status) {
    case 401:
      return '登录已过期，请重新登录后重试。'
    case 403:
      return '没有权限执行此操作。'
    case 404:
      return '记录或照片已不存在。'
    case 413:
      return '文件超过大小限制。'
    default:
      return response?.data?.error || response?.data?.msg || fallback
  }
}
