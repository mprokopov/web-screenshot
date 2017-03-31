package net.edusharing.webshot;

import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
 
public class StressTest {

	// just test with not https server
	private static String SERVER = "http://localhost:2341";
	
	private static final int TOTAL_NUM_OF_REQUESTS = 100;
	private static final int MYTHREADS = 30;
	
	private static long timeStarted = System.currentTimeMillis();
	private static int countOK = 0;
 
	private static ExecutorService executor = Executors.newFixedThreadPool(MYTHREADS);
		
	public static void main(String args[]) throws Exception {
		
		HttpURLConnection.setFollowRedirects(true);
		
		String[] hostList = { 
				
				// test websites
				"http://crunchify.com", 
				"http://bing.com/",
				"http://techcrunch.com/",
				"http://mashable.com/", 
				"http://thenextweb.com/",
				"http://wordpress.com/", 
				"http://wordpress.org/",
				"http://example.com/", 
				"http://sjsu.edu/",
				"http://ebay.co.uk/", 
				"http://google.co.uk/",
				"http://www.wikipedia.org/",
				"http://en.wikipedia.org/wiki/Main_Page",
				
				// try to crash with bad input
				"aids aisdaiusdn adsoihaosi", // just bad input
				"https://upload.wikimedia.org/wikipedia/commons/b/b8/WikipediaLogo-TheOfficiaFour.jpg", // image file
				"http://www.pdf995.com/samples/pdf.pdf", // a PDF file
				"http://ipv4.download.thinkbroadband.com/1GB.zip", // test very big file that is not a website
				
		};
 
		for (int i = 0; i < TOTAL_NUM_OF_REQUESTS; i++) {
 
			String url = hostList[i%hostList.length];
			Runnable worker = new MyRunnable(url);
			executor.execute(worker);
			System.out.println("("+i+") START REQUEST: "+url);
			try { Thread.sleep(300); } catch (Exception e) {}
			
		}
		executor.shutdown();
		// Wait until all threads are finish
		while (!executor.isTerminated()) {
			try {
				Thread.sleep(200);
			} catch (Exception e) {}
		}
		long diffTime = System.currentTimeMillis() - timeStarted;
		System.out.println("\nFinished all threads -> "+diffTime+" ms");
		System.out.println(countOK+" requests finished correct of "+TOTAL_NUM_OF_REQUESTS);
	}
 
	public static class MyRunnable implements Runnable {
		
		private final String url;
 
		MyRunnable(String url) {
			try {
				if (!url.startsWith(SERVER)) url = SERVER+"/?url="+URLEncoder.encode(url,"UTF-8");
			} catch (Exception e) {};
			this.url = url;
		}
 
		@Override
		public void run() {
 
			String result = "";
			int code = 200;
			try {
				
				URL siteURL = new URL(url);
				HttpURLConnection connection = (HttpURLConnection) siteURL
						.openConnection();
				connection.setRequestMethod("GET");
				connection.connect();
 
				code = connection.getResponseCode();
				if (code == 200) {
					result = "OK";
					countOK++;
				} else 
				if (code == 500) {
					result = "SERVER WAS NOT ABLE TO PROCESS (check Url)";
					countOK++; // it should be OK because of bad URLs in test set
				} else 
				if (code == 302) {
					result = "EXCPLICIT REDIRECT 302 ("+connection.getHeaderField("Location")+")";
					try { 
						Thread.sleep(4000); 
						Runnable worker = new MyRunnable(connection.getHeaderField("Location"));
						executor.execute(worker);
					} catch (Exception e) {}
				} else {
				   result = "ERROR("+code+"/"+connection.getResponseMessage()+")\t";
				}
				
			} catch (Exception e) {
				if (e.getMessage().startsWith("Server redirected too many  times")) {
					result = "REDERECTION TIMEOUT (thats OK for a stress test)";
				} else {
					result = "Exception("+e.getMessage()+")";	
				}

			}
			System.out.println(result + " --> "+url);
		}
	}
}