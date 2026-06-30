import { useState, useEffect } from 'react'

export function useThermalPrinter() {
  const [printers, setPrinters] = useState<Electron.PrinterInfo[]>([])
  const [selectedPrinter, setSelectedPrinter] = useState<string>('')
  const [printing, setPrinting] = useState(false)

  const isDesktop = typeof window !== 'undefined' && !!window.electronAPI

  useEffect(() => {
    if (!isDesktop) return
    window.electronAPI.getPrinters().then((list) => {
      setPrinters(list)
      // Auto-select the first thermal-looking printer if none selected
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
      // Fallback: open browser print dialog
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
      await window.electronAPI.printReceipt(html, printerName ?? selectedPrinter)
    } finally {
      setPrinting(false)
    }
  }

  return { printers, selectedPrinter, setSelectedPrinter, printReceipt, printing, isDesktop }
}
