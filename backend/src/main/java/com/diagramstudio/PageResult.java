package com.diagramstudio;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public record PageResult<T>(List<T> items, int page, int size, long total, long totalPages) {
    public static void validate(int page,int size) {
        if(page<0 || page>10_000 || size<1 || size>50) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Page must be 0–10000 and size must be 1–50.");
    }
    public static <T> PageResult<T> of(List<T> items,int page,int size,long total) {
        return new PageResult<>(items,page,size,total,(total+size-1)/size);
    }
}
