using System.Diagnostics;
using System.IO;
using System.Windows;
using Microsoft.Web.WebView2.Core;

namespace AtmosScope;

public partial class MainWindow : Window
{
    private static readonly Uri OrdinaryHome = new("https://atmosscope-weather.phillipchan520.chatgpt.site/");
    private static readonly Uri ProfessionalHome = new("https://app.atmosscope.local/index.html");
    private const string LocalHost = "app.atmosscope.local";
    private const string RuntimeDownload = "https://developer.microsoft.com/microsoft-edge/webview2/";

    public MainWindow()
    {
        InitializeComponent();
        Loaded += InitializeWebView;
    }

    private async void InitializeWebView(object sender, RoutedEventArgs e)
    {
        try
        {
            _ = CoreWebView2Environment.GetAvailableBrowserVersionString();
            await WeatherView.EnsureCoreWebView2Async();
            var webRoot = Path.Combine(AppContext.BaseDirectory, "Web");
            WeatherView.CoreWebView2.SetVirtualHostNameToFolderMapping(LocalHost, webRoot, CoreWebView2HostResourceAccessKind.Allow);
            WeatherView.CoreWebView2.NewWindowRequested += NewWindowRequested;
            WeatherView.CoreWebView2.NavigationStarting += NavigationStarting;
            WeatherView.Source = OrdinaryHome;
        }
        catch (WebView2RuntimeNotFoundException)
        {
            RuntimeError.Visibility = Visibility.Visible;
        }
    }

    private void OrdinaryWeather_Click(object sender, RoutedEventArgs e) => WeatherView.Source = OrdinaryHome;
    private void ProfessionalAtlas_Click(object sender, RoutedEventArgs e) => WeatherView.Source = ProfessionalHome;

    private void NavigationStarting(object? sender, CoreWebView2NavigationStartingEventArgs e)
    {
        if (!IsTrusted(e.Uri)) { e.Cancel = true; OpenExternal(e.Uri); }
    }

    private void NewWindowRequested(object? sender, CoreWebView2NewWindowRequestedEventArgs e)
    {
        e.Handled = true;
        if (IsTrusted(e.Uri)) WeatherView.Source = new Uri(e.Uri); else OpenExternal(e.Uri);
    }

    private static bool IsTrusted(string uri) => Uri.TryCreate(uri, UriKind.Absolute, out var target)
        && target.Scheme == Uri.UriSchemeHttps
        && (target.Host.Equals(LocalHost, StringComparison.OrdinalIgnoreCase) || target.Host.Equals(OrdinaryHome.Host, StringComparison.OrdinalIgnoreCase));

    private static void OpenExternal(string uri) => Process.Start(new ProcessStartInfo(uri) { UseShellExecute = true });
    private void InstallRuntime_Click(object sender, RoutedEventArgs e) => OpenExternal(RuntimeDownload);
}
