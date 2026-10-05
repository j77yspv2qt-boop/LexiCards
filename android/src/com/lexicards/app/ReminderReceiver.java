package com.lexicards.app;

import android.Manifest;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;

import java.util.Calendar;

/* The daily reminder (v2.5).  The switch in Data & settings lives in the
   WebView, but arming an alarm is native work, so this receiver keeps the
   whole daily cycle here:

     - the web side pushes the on/off state and the current due count over the
       LexiNative bridge (setDailyReminder / setReminderDue)
     - the alarm fires at the chosen hour, posts one notification quoting the
       due count, and immediately re-arms itself for the next day
     - opening the app cancels today's notification (MainActivity.onResume)
     - BOOT_COMPLETED re-arms the schedule, because a reboot drops alarms

   Two permissions matter here, and neither is asked for at install time:
   POST_NOTIFICATIONS is a dangerous permission and is only requested when the
   user actually switches the reminder on, while SCHEDULE_EXACT_ALARM is denied
   by default for apps targeting API 33+ - so the exact alarm falls back to the
   inexact one, which still fires (a few minutes late at worst). */
public class ReminderReceiver extends BroadcastReceiver {

    public static final String ACTION_DAILY = "com.lexicards.app.DAILY_REMINDER";
    public static final String CHANNEL_ID = "daily_reminder";
    public static final int NOTIF_ID = 2501;

    private static final String PREFS = "lexi.reminder";

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static boolean enabled(Context c) {
        return prefs(c).getBoolean("on", false);
    }

    public static void setEnabled(Context c, boolean on) {
        prefs(c).edit().putBoolean("on", on).apply();
    }

    /* how many words were due the last time the app was open - the only number
       the WebView knows and the one the notification quotes */
    public static void setDueCount(Context c, int n) {
        prefs(c).edit().putInt("due", Math.max(0, n)).apply();
    }

    public static int dueCount(Context c) {
        return prefs(c).getInt("due", 0);
    }

    public static void setTime(Context c, int hour, int minute) {
        prefs(c).edit().putInt("hour", hour).putInt("min", minute).apply();
    }

    private static int hour(Context c) {
        return prefs(c).getInt("hour", 20);
    }

    private static int minute(Context c) {
        return prefs(c).getInt("min", 0);
    }

    public static void schedule(Context c) {
        if (!enabled(c)) return;
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent pi = pendingIntent(c);
        long at = nextTrigger(c);
        try {
            /* exact alarms are denied by default on API 33+; the inexact variant
               is the documented graceful degradation, so use it rather than
               throwing away the reminder entirely */
            if (Build.VERSION.SDK_INT >= 31 && !am.canScheduleExactAlarms()) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            } else {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            }
        } catch (Throwable t) {
            try { am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi); } catch (Throwable ignored) { }
        }
    }

    public static void cancel(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        try { am.cancel(pendingIntent(c)); } catch (Throwable ignored) { }
    }

    private static PendingIntent pendingIntent(Context c) {
        Intent i = new Intent(c, ReminderReceiver.class);
        i.setAction(ACTION_DAILY);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) flags |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getBroadcast(c, 1, i, flags);
    }

    /* the next occurrence of hour:minute - today if it is still ahead, else
       tomorrow (Calendar keeps this correct across DST and timezone changes) */
    static long nextTrigger(Context c) {
        Calendar cal = Calendar.getInstance();
        cal.set(Calendar.HOUR_OF_DAY, hour(c));
        cal.set(Calendar.MINUTE, minute(c));
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
        if (cal.getTimeInMillis() <= System.currentTimeMillis()) {
            cal.add(Calendar.DAY_OF_YEAR, 1);
        }
        return cal.getTimeInMillis();
    }

    @Override
    public void onReceive(Context ctx, Intent intent) {
        String action = intent != null ? intent.getAction() : null;
        if (Intent.ACTION_BOOT_COMPLETED.equals(action)) {
            schedule(ctx);                       /* re-arm after a reboot */
            return;
        }
        if (!enabled(ctx)) return;
        show(ctx);
        schedule(ctx);                           /* one-shot: arm the next day */
    }

    static void show(Context ctx) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (Build.VERSION.SDK_INT >= 26) {
            if (nm.getNotificationChannel(CHANNEL_ID) == null) {
                NotificationChannel ch = new NotificationChannel(CHANNEL_ID,
                        "Daily reminder", NotificationManager.IMPORTANCE_DEFAULT);
                ch.setDescription("One nudge a day when words are due");
                nm.createNotificationChannel(ch);
            }
        }
        if (Build.VERSION.SDK_INT >= 33 &&
                ctx.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                        != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        if (!nm.areNotificationsEnabled()) return;

        int due = dueCount(ctx);
        String text = due > 0
                ? "今天還有 " + due + " 個詞到期 🔥"
                : "今天到期的詞都複習完了 ✓";

        Intent open = new Intent(ctx, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int pflags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) pflags |= PendingIntent.FLAG_IMMUTABLE;
        PendingIntent pi = PendingIntent.getActivity(ctx, 0, open, pflags);

        Notification.Builder b = (Build.VERSION.SDK_INT >= 26)
                ? new Notification.Builder(ctx, CHANNEL_ID)
                : new Notification.Builder(ctx);
        Notification n = b.setSmallIcon(R.mipmap.ic_launcher_foreground)
                .setContentTitle("LexiCards")
                .setContentText(text)
                .setStyle(new Notification.BigTextStyle().bigText(text))
                .setContentIntent(pi)
                .setAutoCancel(true)
                .build();
        try { nm.notify(NOTIF_ID, n); } catch (Throwable ignored) { }
    }
}
