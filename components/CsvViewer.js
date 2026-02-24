'use client'
import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'

export default function CsvViewer({ url }) {
    const [data, setData] = useState([])
    const [headers, setHeaders] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (!url) {
            setLoading(false)
            return
        }

        const fetchCsv = async () => {
            try {
                const response = await fetch(url)
                if (!response.ok) throw new Error('Failed to fetch CSV')
                const text = await response.text()
                parseCsv(text)
            } catch (err) {
                setError(err.message)
            } finally {
                setLoading(false)
            }
        }

        fetchCsv()
    }, [url])

    const parseCsv = (text) => {
        const lines = text.split('\n').filter(line => line.trim() !== '')
        if (lines.length === 0) {
            setData([])
            setHeaders([])
            return
        }

        // Simple CSV parser - assumes comma separation and no quoted commas for now
        // For more complex CSVs, a library like papaparse is recommended
        const headers = lines[0].split(',').map(h => h.trim())
        const rows = lines.slice(1).map(line => {
            const values = line.split(',')
            return headers.reduce((obj, header, index) => {
                obj[header] = values[index]?.trim() || ''
                return obj
            }, {})
        })

        setHeaders(headers)
        setData(rows)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
        )
    }

    if (error) {
        return (
            <div className="p-4 text-red-500 bg-red-50 rounded-lg">
                Error loading CSV: {error}
            </div>
        )
    }

    if (!url) {
        return (
            <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-lg border border-gray-200 border-dashed">
                No CSV file attached to this project.
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="flex-1 overflow-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                        <tr>
                            {headers.map((header, i) => (
                                <th
                                    key={i}
                                    scope="col"
                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                                >
                                    {header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {data.map((row, i) => (
                            <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                {headers.map((header, j) => (
                                    <td key={j} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {row[header]}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
