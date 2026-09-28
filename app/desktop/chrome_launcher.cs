// GUI launcher preserves Native Messaging pipes without displaying a console.
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
            string data=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),"Pocket Deck","data");
            var info=new ProcessStartInfo(Path.Combine(root,"PocketDeckServer.exe"),"--chrome-host --data-dir \""+data+"\"");
            info.UseShellExecute=false;info.CreateNoWindow=true;
            info.RedirectStandardInput=true;info.RedirectStandardOutput=true;info.RedirectStandardError=true;
            using(var process=Process.Start(info)) {
                Task.Run(()=>{try{Pump(Console.OpenStandardInput(),process.StandardInput.BaseStream);}finally{process.StandardInput.Close();}});
                process.StandardError.ReadToEndAsync();
                Pump(process.StandardOutput.BaseStream,Console.OpenStandardOutput());
                process.WaitForExit();return process.ExitCode;
            }
        }catch{return 1;}
    }
}
