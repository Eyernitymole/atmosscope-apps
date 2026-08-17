using System.Diagnostics;
using System.Windows;
using Microsoft.Web.WebView2.Core;

namespace AtmosScope;

public partial class MainWindow : Window
{
    private static readonly Uri Home = new("https://atmosscope-weather.phillipchan520.chatgpt.site/");
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
            WeatherView.CoreWebView2.NewWindowRequested += NewWindowRequested;
            WeatherView.CoreWebView2.NavigationStarting += NavigationStarting;
            WeatherView.Source = Home;
        }
        catch (WebView2RuntimeNotFoundException)
        {
            RuntimeError.Visibility = Visibility.Visible;
        }
    }

    private void NavigationStarting(object? sender, CoreWebView2NavigationStartingEventArgs e)
    {
        if (!IsTrusted(e.Uri))
        {
            e.Cancel = true;
            OpenExternal(e.Uri);
        }
    }

    private void NewWindowRequested(object? sender, CoreWebView2NewWindowRequestedEventArgs e)
    {
        e.Handled = true;
        if (IsTrusted(e.Uri))
        {
            WeatherView.Source = new Uri(e.Uri);
            return;
        }
        OpenExternal(e.Uri);
    }

    private static bool IsTrusted(string uri) =>
        Uri.TryCreate(uri, UriKind.Absolute, out var target)
        && target.Scheme == Uri.UriSchemeHttps
        && target.Host.Equals(Home.Host, StringComparison.OrdinalIgnoreCase);

    private static void OpenExternal(string uri)
    {
        Process.Start(new ProcessStartInfo(uri) { UseShellExecute = true });
    }

    private void InstallRuntime_Click(object sender, RoutedEventArgs e)
    {
        OpenExternal(RuntimeDownload);
    }
}
