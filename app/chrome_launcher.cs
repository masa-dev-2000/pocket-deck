// GUI subsystem: native-message pipes are forwarded without opening a console.
using System;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;
class Launcher {
    static void Pump(Stream source, Stream target) {
        byte[] buffer=new byte[8192];int count;
        while((count=source.Read(buffer,0,buffer.Length))>0){target.Write(buffer,0,count);target.Flush();}
    }
    static int Main() {
        try {
            string root=AppDomain.CurrentDomain.BaseDirectory;
            string python=File.ReadAllText(Path.Combine(root,"chrome-python.txt")).Trim();
            var info=new ProcessStartInfo(python,"\""+Path.Combine(root,"chrome_host.py")+"\"");
            info.UseShellExecute=false; info.CreateNoWindow=true;
            info.RedirectStandardInput=true; info.RedirectStandardOutput=true; info.RedirectStandardError=true;
            using(var process=Process.Start(info)) {
                var input=Task.Run(()=>{try {Pump(Console.OpenStandardInput(),process.StandardInput.BaseStream);} finally {process.StandardInput.Close();}});
                var errors=process.StandardError.ReadToEndAsync();
                Pump(process.StandardOutput.BaseStream,Console.OpenStandardOutput());
                process.WaitForExit();return process.ExitCode;
            }
        } catch { return 1; }
    }
}
