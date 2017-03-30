package net.edusharing.webshot;

import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
 
public class StressTest {
	
	private static final int MYTHREADS = 50;
 
	public static void main(String args[]) throws Exception {
		ExecutorService executor = Executors.newFixedThreadPool(MYTHREADS);
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
 
		for (int i = 0; i < 250; i++) {
 
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
		System.out.println("\nFinished all threads");
	}
 
	public static class MyRunnable implements Runnable {
		
		private final String url;
 
		MyRunnable(String url) {
			try {
				url = "http://localhost:2341?url="+URLEncoder.encode(url,"UTF-8");
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
				} else 
				if (code == 500) {
					result = "SERVER WAS NOT ABLE TO PROCESS (check Url)";
				} else {
				   result = "ERROR("+code+")\t";
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