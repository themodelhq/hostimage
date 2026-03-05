import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { getLoginUrl } from "@/const";
import { Streamdown } from 'streamdown';
import { useLocation } from "wouter";

/**
 * All content in this page are only for example, replace with your own feature implementation
 * When building pages, remember your instructions in Frontend Workflow, Frontend Best Practices, Design Guide and Common Pitfalls
 */
export default function Home() {
  // The userAuth hooks provides authentication state
  // To implement login/logout functionality, simply call logout() or redirect to getLoginUrl()
  let { user, loading, error, isAuthenticated, logout } = useAuth();
  const [, navigate] = useLocation();

  // If theme is switchable in App.tsx, we can implement theme toggling like this:
  // const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen flex flex-col">
      <main className="p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-4">Image Hosting App</h1>
          <p className="text-lg text-gray-600 mb-8">Welcome to the Image Hosting Application</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 border rounded-lg hover:shadow-lg transition">
              <h2 className="text-2xl font-semibold mb-2">Bulk Image Converter</h2>
              <p className="text-gray-600 mb-4">Convert and host images from Excel files in bulk. Upload an Excel file with image URLs and convert them to JPG, PNG, WebP, or TIFF formats.</p>
              <Button onClick={() => navigate("/converter")} variant="default">
                Go to Converter
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
