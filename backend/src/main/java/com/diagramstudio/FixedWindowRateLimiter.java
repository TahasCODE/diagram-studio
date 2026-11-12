package com.diagramstudio;

import java.time.Clock;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

/** Bounded per-process limiter. Shared ingress enforcement is needed across replicas. */
public final class FixedWindowRateLimiter {
    public record Decision(boolean allowed, long retryAfterSeconds) {}
    private record Window(long startsAt, int attempts) {}
    private final int limit;
    private final long windowMillis;
    private final int maxKeys;
    private final Clock clock;
    private final Map<String,Window> windows = new HashMap<>();
    public FixedWindowRateLimiter(int limit, Duration window, int maxKeys, Clock clock) {
        if(limit<1 || window.toMillis()<1000 || maxKeys<1) throw new IllegalArgumentException("Invalid rate limit configuration.");
        this.limit=limit;this.windowMillis=window.toMillis();this.maxKeys=maxKeys;this.clock=clock;
    }
    public synchronized Decision acquire(String key) {
        long now=clock.millis();
        Window current=windows.get(key);
        if(current==null || now-current.startsAt()>=windowMillis) {
            if(current==null && windows.size()>=maxKeys) windows.entrySet().removeIf(e -> now-e.getValue().startsAt()>=windowMillis);
            if(current==null && windows.size()>=maxKeys) return new Decision(false,Math.max(1,windowMillis/1000));
            windows.put(key,new Window(now,1));
            return new Decision(true,0);
        }
        if(current.attempts()>=limit) return new Decision(false,Math.max(1,(windowMillis-(now-current.startsAt())+999)/1000));
        windows.put(key,new Window(current.startsAt(),current.attempts()+1));
        return new Decision(true,0);
    }
    public synchronized int trackedKeys() { return windows.size(); }
}
