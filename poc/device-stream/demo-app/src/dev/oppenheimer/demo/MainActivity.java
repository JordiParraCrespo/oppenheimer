package dev.oppenheimer.demo;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

// A one-screen app for the device-stream POC: a counter the reader and the
// agent can both tap, and a field whose text is echoed back, so taps and
// typing from the browser show up on the streamed screen.
public class MainActivity extends Activity implements View.OnClickListener, TextWatcher {
    private int count = 0;
    private TextView counter;
    private TextView echo;
    private Button tap;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER_HORIZONTAL);
        root.setPadding(64, 160, 64, 64);
        root.setBackgroundColor(Color.parseColor("#F6F6F4"));

        TextView title = new TextView(this);
        title.setText("Session demo");
        title.setTextSize(28);
        title.setTextColor(Color.parseColor("#1C1C1A"));
        root.addView(title);

        counter = new TextView(this);
        counter.setText("0");
        counter.setTextSize(96);
        counter.setTextColor(Color.parseColor("#2F5BEA"));
        counter.setGravity(Gravity.CENTER);
        counter.setContentDescription("counter");
        root.addView(counter);

        tap = new Button(this);
        tap.setText("Tap me");
        tap.setTextSize(22);
        tap.setOnClickListener(this);
        root.addView(tap, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 200));

        Button reset = new Button(this);
        reset.setText("Reset");
        reset.setOnClickListener(this);
        root.addView(reset);

        EditText field = new EditText(this);
        field.setHint("Type here");
        field.setTextSize(20);
        root.addView(field, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        echo = new TextView(this);
        echo.setTextSize(20);
        echo.setTextColor(Color.parseColor("#6B6B66"));
        root.addView(echo);
        field.addTextChangedListener(this);

        setContentView(root);
    }

    @Override
    public void onClick(View v) {
        count = v == tap ? count + 1 : 0;
        counter.setText(String.valueOf(count));
    }

    @Override
    public void beforeTextChanged(CharSequence s, int start, int count, int after) {}

    @Override
    public void onTextChanged(CharSequence s, int start, int before, int count) {}

    @Override
    public void afterTextChanged(Editable s) {
        echo.setText(s.length() == 0 ? "" : "You typed: " + s);
    }
}
