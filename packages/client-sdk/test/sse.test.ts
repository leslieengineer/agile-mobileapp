import { describe, expect, it } from 'vitest'
import { SseParser } from '../src/sse.js'

describe('SSE parser', () => {
  it('handles chunk boundaries, CRLF and multiline data', () => {
    const parser = new SseParser()
    expect(parser.push('id: 4\r\nevent: mes')).toEqual([])
    expect(parser.push('sage\r\ndata: {"type":"status",\r\ndata: "data":{}}\r\n\r\n')).toEqual([{
      id: '4',
      event: 'message',
      data: '{"type":"status",\n"data":{}}',
      retry: undefined,
    }])
  })

  it('ignores comments and preserves server retry', () => {
    const parser = new SseParser()
    parser.push('retry: 1500\n\n: ping\n\n')
    expect(parser.push('data: {}\n\n')[0]?.retry).toBe(1500)
  })
})
