import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Download, Copy, Check, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type ConvertedImage = {
  originalUrl: string;
  convertedUrl: string;
  error?: string;
};

type Summary = {
  total: number;
  succeeded: number;
  failed: number;
};

/** Convert an ArrayBuffer to base64 without relying on Node's Buffer */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export default function ImageConverter() {
  const [file, setFile] = useState<File | null>(null);
  const [targetFormat, setTargetFormat] = useState<"jpeg" | "png" | "webp" | "tiff">("jpeg");
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<ConvertedImage[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
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
      setResults([]);
      setSummary(null);
    }
  };

  const handleConvert = async () => {
    if (!file) {
      toast.error("Please select an Excel file");
      return;
    }

    setIsLoading(true);
    setResults([]);
    setSummary(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64String = arrayBufferToBase64(arrayBuffer);

      const response = await convertAndHostMutation.mutateAsync({
        excelFileBase64: base64String,
        targetFormat,
      });

      setResults(response.convertedImageUrls);
      setSummary(response.summary);

      if (response.summary.failed === 0) {
        toast.success(`Successfully converted and hosted ${response.summary.succeeded} images`);
      } else if (response.summary.succeeded === 0) {
        toast.error(`All ${response.summary.failed} images failed to convert`);
      } else {
        toast.warning(
          `${response.summary.succeeded} converted, ${response.summary.failed} failed`
        );
      }
    } catch (error: unknown) {
      console.error("Error converting images:", error);
      const message =
        error instanceof Error ? error.message : "Failed to convert images. Please try again.";
      toast.error(message);
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
      ["Original URL", "Converted URL", "Status"],
      ...results.map((r) => [
        r.originalUrl,
        r.convertedUrl,
        r.error ? `Error: ${r.error}` : "OK",
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "converted-images.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const successfulResults = results.filter((r) => r.convertedUrl);
  const failedResults = results.filter((r) => !r.convertedUrl);

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
                <CardDescription>
                  Select an Excel file with image URLs in columns named MainImage, Image2 … Image8
                </CardDescription>
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

                <Button onClick={handleConvert} disabled={!file || isLoading} className="w-full">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Converting…
                    </>
                  ) : (
                    "Convert & Host"
                  )}
                </Button>

                {summary && (
                  <div className="rounded-md border p-3 text-sm space-y-1">
                    <p className="font-medium">Results</p>
                    <p className="text-green-700">✓ {summary.succeeded} succeeded</p>
                    {summary.failed > 0 && (
                      <p className="text-red-600">✗ {summary.failed} failed</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Results Section */}
          <div className="lg:col-span-2 space-y-6">
            {successfulResults.length > 0 && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Converted Images</CardTitle>
                    <CardDescription>{successfulResults.length} images converted and hosted</CardDescription>
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
                          <TableHead className="w-1/2">Hosted URL</TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {successfulResults.map((result, index) => (
                          <TableRow key={index}>
                            <TableCell className="truncate max-w-[200px] text-sm">
                              <a
                                href={result.originalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                                title={result.originalUrl}
                              >
                                {result.originalUrl.substring(result.originalUrl.lastIndexOf("/") + 1)}
                              </a>
                            </TableCell>
                            <TableCell className="truncate max-w-[200px] text-sm">
                              <a
                                href={result.convertedUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                                title={result.convertedUrl}
                              >
                                {result.convertedUrl.substring(result.convertedUrl.lastIndexOf("/") + 1)}
                              </a>
                            </TableCell>
                            <TableCell>
                              <button
                                onClick={() => handleCopyUrl(result.convertedUrl)}
                                className="p-2 hover:bg-slate-100 rounded"
                                title="Copy hosted URL"
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
            )}

            {failedResults.length > 0 && (
              <Card className="border-red-200">
                <CardHeader>
                  <CardTitle className="text-red-700 flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    Failed Images ({failedResults.length})
                  </CardTitle>
                  <CardDescription>These images could not be downloaded or converted</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>URL</TableHead>
                          <TableHead>Reason</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {failedResults.map((result, index) => (
                          <TableRow key={index}>
                            <TableCell className="truncate max-w-[250px] text-sm text-slate-600" title={result.originalUrl}>
                              {result.originalUrl.substring(result.originalUrl.lastIndexOf("/") + 1)}
                            </TableCell>
                            <TableCell className="text-sm text-red-600">
                              {result.error ?? "Unknown error"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {results.length === 0 && (
              <Card>
                <CardContent className="pt-12 text-center">
                  <p className="text-slate-500">
                    Upload an Excel file and click "Convert & Host" to see results
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
