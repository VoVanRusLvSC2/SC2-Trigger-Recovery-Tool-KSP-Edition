import java.nio.file.Files;
import java.nio.file.Path;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class JavaCandidateFixture {
  public static void main(String[] args) throws Exception {
    String request = Files.readString(Path.of(args[0]));
    Matcher outputMatch = Pattern.compile("\\\"outputDirectory\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"").matcher(request);
    Matcher resultMatch = Pattern.compile("\\\"resultPath\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"").matcher(request);
    if (!outputMatch.find() || !resultMatch.find()) throw new IllegalArgumentException("missing output paths in request");
    Path output = Path.of(outputMatch.group(1).replace("\\\\", "\\"));
    Path result = Path.of(resultMatch.group(1).replace("\\\\", "\\"));
    Files.createDirectories(output);
    Files.writeString(output.resolve("Triggers"), "<TriggerData/>\n");
    Files.writeString(result,
        "{\"schemaVersion\":1,\"status\":\"completed\","
        + "\"artifacts\":[{\"role\":\"trigger-data\",\"path\":\"Triggers\"}],"
        + "\"conversionQuality\":{\"completeness\":\"complete\"},\"diagnostics\":[]}\n");
  }
}
