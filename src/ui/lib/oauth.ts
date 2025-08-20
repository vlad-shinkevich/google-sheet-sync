export async function getStoredAuth(): Promise<{ token: any; userinfo: any }> {
  parent.postMessage({ pluginMessage: { type: 'oauth/get' } }, '*')
  const { token, userinfo } = await new Promise<any>((resolve) => {
    function onMessage(e: MessageEvent) {
      const msg = (e.data && (e as any).data.pluginMessage) || (e as any).data
      if (msg?.type === 'oauth/token') {
        window.removeEventListener('message', onMessage)
        resolve({ token: msg.token, userinfo: msg.userinfo })
      }
    }
    window.addEventListener('message', onMessage)
  })
  return { token, userinfo }
}

export async function saveAuth(token?: any, userinfo?: any): Promise<void> {
  parent.postMessage({ pluginMessage: { type: 'oauth/save', token, userinfo } }, '*')
}

export async function clearAuth(): Promise<void> {
  parent.postMessage({ pluginMessage: { type: 'oauth/clear' } }, '*')
}


