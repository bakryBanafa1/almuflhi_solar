using System;
using System.Drawing;
using System.Net;
using System.Windows.Forms;
using System.Diagnostics;

namespace SolarLauncher
{
    public class UserLauncher : Form
    {
        private const string TARGET_URL = "http://almflhi-solar.futurebot.site/user";

        [STAThread]
        public static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            if (CheckConnection(TARGET_URL))
            {
                try
                {
                    Process.Start(TARGET_URL);
                }
                catch
                {
                    MessageBox.Show("فشل فتح المتصفح. يرجى فتح الرابط يدوياً.", "خطأ", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
            }
            else
            {
                Application.Run(new UserLauncher());
            }
        }

        public static bool CheckConnection(string url)
        {
            try
            {
                var request = (HttpWebRequest)WebRequest.Create(url);
                request.Timeout = 5000;
                request.Method = "GET"; // Changed to GET for better compatibility
                request.KeepAlive = false;
                
                using (var response = (HttpWebResponse)request.GetResponse())
                {
                    return true; // Any successful response means we have internet
                }
            }
            catch (WebException ex)
            {
                // If we get a ProtocolError (like 404, 500), it means we REACHED the server, so we have internet.
                if (ex.Status == WebExceptionStatus.ProtocolError)
                {
                    return true;
                }
                return false;
            }
            catch
            {
                return false;
            }
        }

        public UserLauncher()
        {
            this.Text = "تنبيه: لا يوجد اتصال";
            this.Size = new Size(450, 280);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.RightToLeft = RightToLeft.Yes;
            this.RightToLeftLayout = true;
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.MinimizeBox = false;
            this.BackColor = Color.White;

            // Fonts
            var titleFont = new Font("Segoe UI", 14, FontStyle.Bold);
            var msgFont = new Font("Segoe UI", 11);
            var btnFont = new Font("Segoe UI", 10);

            // Icon Label
            var iconLabel = new Label();
            iconLabel.Text = "⚠️";
            iconLabel.Font = new Font("Segoe UI Emoji", 30);
            iconLabel.Location = new Point(190, 20);
            iconLabel.Size = new Size(60, 60);
            iconLabel.TextAlign = ContentAlignment.MiddleCenter;
            iconLabel.ForeColor = Color.OrangeRed;
            this.Controls.Add(iconLabel);

            // Main Message
            var lblTitle = new Label();
            lblTitle.Text = "عذراً، هذه الواجهة تعمل فقط عبر الإنترنت";
            lblTitle.Font = titleFont;
            lblTitle.ForeColor = Color.DarkSlateGray;
            lblTitle.Location = new Point(20, 80);
            lblTitle.Size = new Size(400, 40);
            lblTitle.TextAlign = ContentAlignment.MiddleCenter;
            this.Controls.Add(lblTitle);

            // Sub Message
            var lblMsg = new Label();
            lblMsg.Text = "يرجى التحقق من اتصالك بالإنترنت والمحاولة مرة أخرى للدخول إلى النظام.";
            lblMsg.Font = msgFont;
            lblMsg.ForeColor = Color.Gray;
            lblMsg.Location = new Point(20, 120);
            lblMsg.Size = new Size(400, 50);
            lblMsg.TextAlign = ContentAlignment.TopCenter;
            this.Controls.Add(lblMsg);

            // Button
            var btnOk = new Button();
            btnOk.Text = "حسناً";
            btnOk.Font = btnFont;
            btnOk.Location = new Point(150, 180);
            btnOk.Size = new Size(130, 35);
            btnOk.BackColor = Color.FromArgb(46, 125, 50); // Theme Green
            btnOk.ForeColor = Color.White;
            btnOk.FlatStyle = FlatStyle.Flat;
            btnOk.FlatAppearance.BorderSize = 0;
            btnOk.Cursor = Cursors.Hand;
            btnOk.Click += (s, e) => Application.Exit();
            this.Controls.Add(btnOk);
        }
    }
}
