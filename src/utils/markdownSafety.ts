const SAFE_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

const baseURL = () => {
  if (typeof window !== 'undefined') return window.location.origin
  return 'http://localhost'
}

export const isSafeMarkdownLink = (href: string): boolean => {
  const value = href.trim()
  if (!value) return false
  if (value.startsWith('#') || value.startsWith('/') || value.startsWith('?')) return true

  try {
    return SAFE_LINK_PROTOCOLS.has(new URL(value, baseURL()).protocol)
  } catch {
    return false
  }
}

const isSafeResourceURL = (value: string): boolean => {
  const trimmed = value.trim()
  if (!trimmed) return true
  if (trimmed.startsWith('data:image/')) return true
  return isSafeMarkdownLink(trimmed)
}

const BLOCKED_TAGS = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'link',
  'meta',
  'base',
  'svg'
])

export const sanitizeMarkdownElement = (root: ParentNode) => {
  root.querySelectorAll('*').forEach((element) => {
    const tag = element.tagName.toLowerCase()
    if (BLOCKED_TAGS.has(tag)) {
      element.remove()
      return
    }

    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase()
      const value = attribute.value

      if (name.startsWith('on') || name === 'srcdoc' || name === 'formaction') {
        element.removeAttribute(attribute.name)
        continue
      }
      if (name === 'style' || name === 'class' || name === 'id') {
        element.removeAttribute(attribute.name)
        continue
      }
      if ((name === 'href' || name === 'xlink:href') && !isSafeMarkdownLink(value)) {
        element.removeAttribute(attribute.name)
        continue
      }
      if (name === 'src' && !isSafeResourceURL(value)) {
        element.removeAttribute(attribute.name)
      }
    }

    if (tag === 'a') {
      const href = element.getAttribute('href')
      if (!href) {
        element.removeAttribute('target')
        element.removeAttribute('rel')
        return
      }
      element.setAttribute('target', '_blank')
      element.setAttribute('rel', 'noopener noreferrer')
    }
  })
}

export const sanitizePastedHTML = (html: string): string => {
  if (typeof DOMParser === 'undefined') return ''
  const document = new DOMParser().parseFromString(html, 'text/html')
  sanitizeMarkdownElement(document.body)
  return document.body.innerHTML
}
