import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { MessageCircle, Mail, Phone, ExternalLink, HelpCircle, LifeBuoy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function Support() {
  usePageMeta({ title: "Support — UCU", description: "Get in touch with Tech Town Swat for help, plan activation and renewals.", path: "/support" });
  const { t } = useTranslation();
  useEffect(() => {
    document.title = "UCU";
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
          <LifeBuoy className="size-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("support.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("support.subtitle")}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageCircle className="size-4 text-success" />
              {t("support.whatsapp")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("support.whatsappBody")}</p>
            <Button asChild className="w-full" variant="default">
              <a
                href="https://wa.me/923105892935"
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="size-4 mr-2" />
                {t("support.chatOnWhatsapp")}
              </a>
            </Button>
            <div className="flex items-center gap-2 text-sm">
              <Phone className="size-3.5 text-muted-foreground" />
              <span className="font-medium">0310 5892935</span>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="size-4 text-primary" />
              {t("support.email")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("support.emailBody")}</p>
            <Button asChild className="w-full" variant="outline">
              <a href="mailto:uihtisham0@gmail.com">
                <Mail className="size-4 mr-2" />
                uihtisham0@gmail.com
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <HelpCircle className="size-4 text-primary" />
            {t("support.commonQuestions")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <div className="font-semibold mb-1">{t("support.q1")}</div>
            <p className="text-muted-foreground">{t("support.a1")}</p>
          </div>
          <div>
            <div className="font-semibold mb-1">{t("support.q2")}</div>
            <p className="text-muted-foreground">{t("support.a2")}</p>
          </div>
          <div>
            <div className="font-semibold mb-1">{t("support.q3")}</div>
            <p className="text-muted-foreground">{t("support.a3")}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-primary/5 to-amber-500/5 border-primary/20">
        <CardContent className="py-5 text-center space-y-1">
          <div className="text-sm text-muted-foreground">{t("support.createdBy")}</div>
          <a
            href="https://techtownswat.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-base font-bold text-primary hover:underline"
          >
            Tech Town Swat
            <ExternalLink className="size-3.5" />
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
