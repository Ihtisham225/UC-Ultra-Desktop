import { useState, useEffect } from 'react'

interface PrinterInfo {
  name: string
  displayName?: string
  description?: string
  status?: number
  isDefault?: boolean
}

declare global {
  interface Window {
    electronAPI?: {
      getPrinters: () => Promise<PrinterInfo[]>
      printReceipt: (html: string, printerName?: string) => Promise<void>
      platform?: string
      onUpdateAvailable?: (cb: (version: string) => void) => void
      onUpdateDownloaded?: (cb: (version: string) => void) => void
      installUpdate?: () => void
      getAppVersion?: () => Promise<string>
    }
  }
}

export function useThermalPrinter() {
  const [printers, setPrinters] = useState<PrinterInfo[]>([])
  const [selectedPrinter, setSelectedPrinter] = useState<string>('')
  const [printing, setPrinting] = useState(false)

  const isDesktop = typeof window !== 'undefined' && !!window.electronAPI

  useEffect(() => {
    if (!isDesktop) return
    window.electronAPI!.getPrinters().then((list) => {
      setPrinters(list)
      const thermal = list.find(
        (p) =>
          p.name.toLowerCase().includes('thermal') ||
          p.name.toLowerCase().includes('receipt') ||
          p.name.toLowerCase().includes('pos') ||
          p.name.toLowerCase().includes('xprinter') ||
          p.name.toLowerCase().includes('epson') ||
          p.name.toLowerCase().includes('star')
      )
      setSelectedPrinter(thermal?.name ?? list[0]?.name ?? '')
    })
  }, [isDesktop])

  async function printReceipt(html: string, printerName?: string) {
    if (!isDesktop) {
      const w = window.open('', '_blank')
      if (w) {
        w.document.write(html)
        w.document.close()
        w.print()
      }
      return
    }
    setPrinting(true)
    try {
      await window.electronAPI!.printReceipt(html, printerName ?? selectedPrinter)
    } finally {
      setPrinting(false)
    }
  }

  return { printers, selectedPrinter, setSelectedPrinter, printReceipt, printing, isDesktop }
}
