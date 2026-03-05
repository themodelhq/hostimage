import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Download, Copy, Check } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function ImageConverter() {
  const [file, setFile] = useState<File | null>(null);
  const [targetFormat, setTargetFormat] = useState<"jpeg" | "png" | "webp" | "tiff">("jpeg");
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<{ originalUrl: string; convertedUrl: string }[]>([]);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const convertAndHostMutation = trpc.imageConverter.convertAndHost.useMutation();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith(".xlsx") && !selectedFile.name.endsWith(".xls")) {
        toast.error("Please select a valid Excel file (.xlsx or .xls)");
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleConvert = async () => {
    if (!file) {
      toast.error("Please select an Excel file");
      return;
    }

    setIsLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64String = Buffer.from(arrayBuffer).toString("base64");

      const response = await convertAndHostMutation.mutateAsync({
        excelFileBase64: base64String,
        targetFormat,
      });

      setResults(response.convertedImageUrls);
      toast.success(`Successfully converted and hosted ${response.convertedImageUrls.length} images`);
    } catch (error) {
      console.error("Error converting images:", error);
      toast.error("Failed to convert images. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    toast.success("URL copied to clipboard");
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const downloadResults = () => {
    const csv = [
      ["Original URL", "Converted URL"],
      ...results.map((r) => [r.originalUrl, r.convertedUrl]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "converted-images.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Bulk Image Converter</h1>
          <p className="text-slate-600">Convert and host images from Excel files in bulk</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Upload Section */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Upload Excel File</CardTitle>
                <CardDescription>Select an Excel file with image URLs</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="excel-file">Excel File</Label>
                  <Input
                    id="excel-file"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                    disabled={isLoading}
                  />
                  {file && <p className="text-sm text-slate-600">Selected: {file.name}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="format-select">Target Format</Label>
                  <Select value={targetFormat} onValueChange={(value: any) => setTargetFormat(value)}>
                    <SelectTrigger id="format-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="jpeg">JPEG</SelectItem>
                      <SelectItem value="png">PNG</SelectItem>
                      <SelectItem value="webp">WebP</SelectItem>
                      <SelectItem value="tiff">TIFF</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleConvert}
                  disabled={!file || isLoading}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Converting...
                    </>
                  ) : (
                    "Convert & Host"
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Results Section */}
          <div className="lg:col-span-2">
            {results.length > 0 ? (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Conversion Results</CardTitle>
                    <CardDescription>{results.length} images converted and hosted</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={downloadResults}>
                    <Download className="mr-2 h-4 w-4" />
                    Download CSV
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-1/2">Original URL</TableHead>
                          <TableHead className="w-1/2">Converted URL</TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.map((result, index) => (
                          <TableRow key={index}>
                            <TableCell className="truncate text-sm">
                              <a
                                href={result.originalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                {result.originalUrl.substring(result.originalUrl.lastIndexOf("/") + 1)}
                              </a>
                            </TableCell>
                            <TableCell className="truncate text-sm">
                              <a
                                href={result.convertedUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                {result.convertedUrl.substring(result.convertedUrl.lastIndexOf("/") + 1)}
                              </a>
                            </TableCell>
                            <TableCell>
                              <button
                                onClick={() => handleCopyUrl(result.convertedUrl)}
                                className="p-2 hover:bg-slate-100 rounded"
                              >
                                {copiedUrl === result.convertedUrl ? (
                                  <Check className="h-4 w-4 text-green-600" />
                                ) : (
                                  <Copy className="h-4 w-4 text-slate-600" />
                                )}
                              </button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="pt-12 text-center">
                  <p className="text-slate-500">Upload an Excel file and click "Convert & Host" to see results</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
