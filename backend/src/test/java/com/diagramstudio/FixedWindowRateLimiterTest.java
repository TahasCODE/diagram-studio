package com.diagramstudio;
import java.time.*;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class FixedWindowRateLimiterTest {
    static class MutableClock extends Clock {
        long millis;
        @Override public ZoneId getZone(){return ZoneOffset.UTC;}
        @Override public Clock withZone(ZoneId zone){return this;}
        @Override public Instant instant(){return Instant.ofEpochMilli(millis);}
        @Override public long millis(){return millis;}
    }
    @Test void blocksOnlyAfterConfiguredAttemptsAndReportsRetryTime() {
        var clock=new MutableClock();var limiter=new FixedWindowRateLimiter(2,Duration.ofSeconds(60),10,clock);
        assertTrue(limiter.acquire("one").allowed());assertTrue(limiter.acquire("one").allowed());
        clock.millis=1001;
        var decision=limiter.acquire("one");assertFalse(decision.allowed());assertEquals(59,decision.retryAfterSeconds());
        assertTrue(limiter.acquire("two").allowed());
        clock.millis=60000;assertTrue(limiter.acquire("one").allowed());
    }
    @Test void boundsMemoryAndReclaimsExpiredKeys() {
        var clock=new MutableClock();var limiter=new FixedWindowRateLimiter(1,Duration.ofSeconds(10),2,clock);
        limiter.acquire("a");limiter.acquire("b");assertFalse(limiter.acquire("c").allowed());assertEquals(2,limiter.trackedKeys());
        clock.millis=10000;assertTrue(limiter.acquire("c").allowed());assertEquals(1,limiter.trackedKeys());
    }
    @Test void rejectsInvalidConfiguration() {assertThrows(IllegalArgumentException.class,()->new FixedWindowRateLimiter(0,Duration.ofSeconds(1),2,Clock.systemUTC()));}
}
