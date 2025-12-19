import { useMemo } from "react"

interface JsonDisplayProps {
  data: unknown
}

type JsonToken = {
  type: "key" | "string" | "number" | "boolean" | "null" | "punctuation"
  value: string
}

function tokenizeJson(json: string): JsonToken[] {
  const tokens: JsonToken[] = []
  let i = 0

  while (i < json.length) {
    const char = json[i]

    // Whitespace - preserve it
    if (/\s/.test(char)) {
      let ws = ""
      while (i < json.length && /\s/.test(json[i])) {
        ws += json[i]
        i++
      }
      tokens.push({ type: "punctuation", value: ws })
      continue
    }

    // Punctuation
    if (["{", "}", "[", "]", ",", ":"].includes(char)) {
      tokens.push({ type: "punctuation", value: char })
      i++
      continue
    }

    // String
    if (char === '"') {
      let str = '"'
      i++
      while (i < json.length && json[i] !== '"') {
        if (json[i] === "\\") {
          str += json[i] + json[i + 1]
          i += 2
        } else {
          str += json[i]
          i++
        }
      }
      str += '"'
      i++

      // Check if this is a key (followed by colon)
      let j = i
      while (j < json.length && /\s/.test(json[j])) j++
      const isKey = json[j] === ":"

      tokens.push({ type: isKey ? "key" : "string", value: str })
      continue
    }

    // Number
    if (/[-\d]/.test(char)) {
      let num = ""
      while (i < json.length && /[-\d.eE+]/.test(json[i])) {
        num += json[i]
        i++
      }
      tokens.push({ type: "number", value: num })
      continue
    }

    // Boolean or null
    if (json.slice(i, i + 4) === "true") {
      tokens.push({ type: "boolean", value: "true" })
      i += 4
      continue
    }
    if (json.slice(i, i + 5) === "false") {
      tokens.push({ type: "boolean", value: "false" })
      i += 5
      continue
    }
    if (json.slice(i, i + 4) === "null") {
      tokens.push({ type: "null", value: "null" })
      i += 4
      continue
    }

    // Unknown character
    tokens.push({ type: "punctuation", value: char })
    i++
  }

  return tokens
}

export function JsonDisplay({ data }: JsonDisplayProps) {
  const rendered = useMemo(() => {
    if (data === null || data === undefined) {
      return <span className="json-null">null</span>
    }

    const json = JSON.stringify(data, null, 2)
    const tokens = tokenizeJson(json)

    return tokens.map((token, index) => (
      <span key={index} className={`json-${token.type}`}>
        {token.value}
      </span>
    ))
  }, [data])

  return <pre>{rendered}</pre>
}
