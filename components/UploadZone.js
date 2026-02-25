'use client'
import { useState, useCallback } from 'react'
import { supabase } from '@/utils/supabase'
import { UploadCloud, Loader2, FileType, FileText, X, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function UploadZone() {
    const [uploading, setUploading] = useState(false)
    const [jobName, setJobName] = useState('')
    const [notes, setNotes] = useState('')
    const [bioFiles, setBioFiles] = useState([])
    const [csvFile, setCsvFile] = useState(null)
    const router = useRouter()

    const handleBioFilesChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files)
            setBioFiles(prev => [...prev, ...newFiles])
        }
        e.target.value = ''
    }

    const removeBioFile = (index) => {
        setBioFiles(prev => prev.filter((_, i) => i !== index))
    }

    const handleCsvChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setCsvFile(e.target.files[0])
        }
    }

    const removeCsvFile = () => {
        setCsvFile(null)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (bioFiles.length === 0) {
            alert('Please upload at least one biological structure file.')
            return
        }
        if (!jobName.trim()) {
            alert('Please enter a job name.')
            return
        }

        setUploading(true)
        try {
            const user = (await supabase.auth.getUser()).data.user
            if (!user) throw new Error('You must be logged in to upload.')

            const timestamp = Date.now()

            // 1. Upload all biological files
            const uploadedFiles = []

            for (let i = 0; i < bioFiles.length; i++) {
                const file = bioFiles[i]
                const bioFileExt = file.name.split('.').pop().toLowerCase()
                const bioFileName = `${timestamp}_${i}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
                const bioFilePath = `${user.id}/${bioFileName}`

                const { error: bioUploadError } = await supabase.storage
                    .from('molecules')
                    .upload(bioFilePath, file)

                if (bioUploadError) throw bioUploadError

                const { data: { publicUrl: bioPublicUrl } } = supabase.storage
                    .from('molecules')
                    .getPublicUrl(bioFilePath)

                uploadedFiles.push({
                    url: bioPublicUrl,
                    extension: bioFileExt,
                    name: file.name,
                    sort_order: i
                })
            }

            // 2. Upload CSV file (if exists)
            let csvPublicUrl = null
            let csvFileNameStr = null

            if (csvFile) {
                const csvFileName = `${timestamp}_${csvFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
                const csvFilePath = `${user.id}/${csvFileName}`

                const { error: csvUploadError } = await supabase.storage
                    .from('molecules')
                    .upload(csvFilePath, csvFile)

                if (csvUploadError) throw csvUploadError

                const { data: { publicUrl } } = supabase.storage
                    .from('molecules')
                    .getPublicUrl(csvFilePath)

                csvPublicUrl = publicUrl
                csvFileNameStr = csvFile.name
            }

            // 3. Save project metadata (use first file as the legacy file_url)
            const firstFile = uploadedFiles[0]
            const { data: projectData, error: dbError } = await supabase
                .from('projects')
                .insert({
                    owner_id: user.id,
                    title: jobName.trim(),
                    file_url: firstFile.url,
                    file_extension: firstFile.extension,
                    csv_file_url: csvPublicUrl,
                    csv_file_name: csvFileNameStr,
                    is_public: true,
                    notes: notes.trim() || null
                })
                .select()
                .single()

            if (dbError) throw dbError

            // 4. Save all files to project_files table
            const fileInserts = uploadedFiles.map(f => ({
                project_id: projectData.id,
                owner_id: user.id,
                file_url: f.url,
                file_extension: f.extension,
                file_name: f.name,
                sort_order: f.sort_order
            }))

            const { error: filesDbError } = await supabase
                .from('project_files')
                .insert(fileInserts)

            if (filesDbError) {
                console.error('Error saving project files:', filesDbError)
                // Non-critical: project was still created with legacy file_url
            }

            // Reset form
            setBioFiles([])
            setCsvFile(null)
            setJobName('')
            setNotes('')

            // Navigate to the newly created project
            router.push(`/view/${projectData.id}`)

        } catch (error) {
            console.error(error)
            alert('Error submitting job: ' + error.message)
        } finally {
            setUploading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Job Name */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Job Name</label>
                <input
                    type="text"
                    value={jobName}
                    onChange={(e) => setJobName(e.target.value)}
                    placeholder="e.g., Protein Analysis 001"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Bio Files Upload (Multi-file) */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Biological Structures
                        <span className="text-gray-400 font-normal ml-1">(multiple files allowed)</span>
                    </label>

                    {/* File List */}
                    {bioFiles.length > 0 && (
                        <div className="space-y-2 mb-3">
                            {bioFiles.map((file, index) => (
                                <div key={index} className="flex items-center justify-between p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <FileType className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                                        <span className="text-sm font-medium text-indigo-900 truncate">{file.name}</span>
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-600 font-mono uppercase flex-shrink-0">
                                            {file.name.split('.').pop()}
                                        </span>
                                    </div>
                                    <button type="button" onClick={() => removeBioFile(index)} className="text-gray-400 hover:text-red-500 flex-shrink-0 ml-2">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Add More Files Button */}
                    <div className="relative group">
                        <div className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-colors">
                            {bioFiles.length === 0 ? (
                                <>
                                    <UploadCloud className="w-7 h-7 text-gray-400 group-hover:text-indigo-500 mb-1" />
                                    <span className="text-sm text-gray-500">PDB, SDF, MOL2, etc.</span>
                                </>
                            ) : (
                                <>
                                    <Plus className="w-6 h-6 text-gray-400 group-hover:text-indigo-500 mb-1" />
                                    <span className="text-xs text-gray-500">Add more files</span>
                                </>
                            )}
                            <input
                                type="file"
                                multiple
                                onChange={handleBioFilesChange}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                accept=".pdb,.sdf,.mol2,.xyz,.cif,.cube,.pqr"
                            />
                        </div>
                    </div>
                </div>

                {/* CSV File Upload */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data File (CSV)</label>
                    <div className="relative group">
                        {!csvFile ? (
                            <div className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-colors">
                                <FileText className="w-8 h-8 text-gray-400 group-hover:text-indigo-500 mb-2" />
                                <span className="text-sm text-gray-500">CSV/Excel Data</span>
                                <input
                                    type="file"
                                    onChange={handleCsvChange}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    accept=".csv"
                                />
                            </div>
                        ) : (
                            <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <FileText className="w-5 h-5 text-green-600 flex-shrink-0" />
                                    <span className="text-sm font-medium text-green-900 truncate">{csvFile.name}</span>
                                </div>
                                <button type="button" onClick={removeCsvFile} className="text-gray-400 hover:text-red-500">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Notes */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any specific details or hypothesis..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 h-24 resize-none"
                />
            </div>

            {/* File Count & Submit Button */}
            <div className="flex items-center justify-between pt-2">
                <span className="text-sm text-gray-500">
                    {bioFiles.length > 0 && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium">
                            <FileType className="w-3 h-3" />
                            {bioFiles.length} file{bioFiles.length !== 1 ? 's' : ''} selected
                        </span>
                    )}
                </span>
                <button
                    type="submit"
                    disabled={uploading}
                    className="px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    {uploading ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Sending Job...
                        </>
                    ) : (
                        'Submit Job'
                    )}
                </button>
            </div>
        </form>
    )
}
