// useSerialChipId.ts — Hook para leer el chip ID del ESP32 via Web Serial API
//
// El admin conecta el ESP32 por USB al computador, y desde el navegador
// (Chrome/Edge) puede leer el chip ID directamente sin instalar nada.
//
// Requiere que el ESP32 tenga el sketch chip-id-reader.ino flasheado.
// El sketch imprime el chip ID repetidamente por serial a 115200 baud.
//
// Web Serial API solo funciona en Chrome/Edge sobre HTTPS o localhost.

import { useState, useCallback } from 'react'

interface SerialPort extends EventTarget {
  open(options: { baudRate: number }): Promise<void>
  close(): Promise<void>
  readable: ReadableStream<Uint8Array> | null
  writable: WritableStream<Uint8Array> | null
}

interface SerialNavigator extends Navigator {
  serial: {
    requestPort(options?: { filters?: unknown[] }): Promise<SerialPort>
    getPorts(): Promise<SerialPort[]>
  }
}

export function useSerialChipId() {
  const [chipId, setChipId] = useState('')
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState('')
  const [supported, setSupported] = useState(
    typeof navigator !== 'undefined' && 'serial' in navigator
  )

  // Extraer el chip ID (12 hex chars) del output serial
  const extractChipId = (text: string): string | null => {
    // El sketch imprime: "Chip ID (12 hex): AABBCCDDEEFF"
    const match = text.match(/Chip ID \(12 hex\):\s*([0-9A-Fa-f]{12})/)
    if (match) return match[1].toUpperCase()
    // Fallback: buscar cualquier secuencia de 12 hex despues de "Chip ID"
    const match2 = text.match(/Chip ID[^:]*:\s*([0-9A-Fa-f]{12})/)
    if (match2) return match2[1].toUpperCase()
    return null
  }

  const scan = useCallback(async () => {
    setError('')
    setChipId('')
    setScanning(true)

    try {
      const nav = navigator as SerialNavigator
      if (!nav.serial) {
        setError('Web Serial API no soportada. Usa Chrome o Edge.')
        setScanning(false)
        return
      }

      // Pedir al usuario que seleccione el puerto serial
      const port = await nav.serial.requestPort()
      await port.open({ baudRate: 115200 })

      // Leer del stream serial hasta encontrar el chip ID
      const reader = port.readable!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let found = false
      const timeoutMs = 10000
      const startTime = Date.now()

      try {
        while (!found && Date.now() - startTime < timeoutMs) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          // Buscar el chip ID en el buffer
          const id = extractChipId(buffer)
          if (id) {
            setChipId(id)
            found = true
            break
          }
        }
      } finally {
        reader.releaseLock()
        await port.close()
      }

      if (!found) {
        setError('No se encontro el chip ID. Asegurate de que el ESP32 tiene el sketch chip-id-reader.ino flasheado.')
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotFoundError') {
        setError('No se selecciono ningun puerto serial.')
      } else if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setError('Permiso denegado para acceder al puerto serial.')
      } else {
        setError(err instanceof Error ? err.message : 'Error al escanear')
      }
    } finally {
      setScanning(false)
    }
  }, [])

  return { chipId, scanning, error, supported, scan }
}
