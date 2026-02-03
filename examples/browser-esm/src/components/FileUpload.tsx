import React from 'react';

interface FileUploadProps {
  onFileSelect: (file: File, extension: string) => void;
  acceptedFormats: string[];
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  acceptedFormats,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension || !acceptedFormats.includes(extension)) {
      alert(`Unsupported format. Accepted: ${acceptedFormats.join(', ')}`);
      return;
    }

    onFileSelect(file, extension);
  };

  return (
    <div>
      <input
        type="file"
        accept={acceptedFormats.map((ext) => `.${ext}`).join(',')}
        onChange={handleChange}
      />
    </div>
  );
};
